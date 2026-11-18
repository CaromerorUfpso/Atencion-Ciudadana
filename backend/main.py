import os
import re
import unicodedata
from pathlib import Path

from fastapi.responses import FileResponse
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware

from auth import (
    bloqueado, borrar_cookie, crear_sesion, datos_publicos, esquema_cookie,
    funcionario_actual, hash_token, limpiar_intentos, poner_cookie,
    registrar_fallo, verificar_password,
)
from errores import ErrorApi, manejar_error_api
from database import get_db
from ia import CATEGORIAS, TIPOS, URGENCIAS, clasificar_y_responder
from whatsapp import CARPETA_ADJUNTOS, descargar_pdf, enviar_mensaje, enviar_plantilla_avance

app = FastAPI(title="Atención ciudadana - Alcaldía de Río de Oro")
app.add_exception_handler(ErrorApi, manejar_error_api)

ORIGENES_FRONT = [
    o.strip() for o in os.getenv("FRONT_ORIGINS", "http://localhost:5173").split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES_FRONT,
    allow_credentials=True,  # necesario para que viaje la cookie
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)
VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN")


DOCUMENTOS_POR_CATEGORIA = {
    "cita": ["orden_medica", "documento_identidad"],
    "autorizacion": ["orden_medica", "historia_clinica", "documento_identidad"],
    "medicamento": ["orden_medica", "documento_identidad"],
}

TIPOS_IDENTIFICACION = {
    "1": "CC", "2": "TI", "3": "CE", "4": "PPT", "5": "PA", "6": "RC",
}

PREGUNTAS = {
    "consentimiento": (
        "Para tramitar tu caso necesitamos algunos datos personales y "
        "documentos médicos. ¿Autorizas a la Alcaldía de Río de Oro a usar "
        "tus datos, incluidos los de salud, solo para gestionar esta "
        "solicitud, según la Ley 1581 de 2012?\n\nResponde *SI* o *NO*."
    ),
    "tipo_documento": (
        "¿Qué tipo de documento tienes? Responde con el número:\n"
        "1. Cédula de ciudadanía\n2. Tarjeta de identidad\n"
        "3. Cédula de extranjería\n4. PPT\n5. Pasaporte\n6. Registro civil"
    ),
    "numero_documento": "Escribe tu número de documento, sin puntos ni espacios.",
    "orden_medica": (
        "Envíame en PDF la *orden médica* o *fórmula médica*.\n"
        "Si no la tienes, escribe *NO TENGO*."
    ),
    "historia_clinica": (
        "Ahora envíame en PDF la *historia clínica*.\n"
        "Si no la tienes, escribe *NO TENGO*."
    ),
    "documento_identidad": (
        "Por último, envíame en PDF tu *documento de identidad*.\n"
        "Si no lo tienes, escribe *NO TENGO*."
    ),
}




def limpiar(texto: str) -> str:
    """Pasa a minúsculas y quita tildes: 'Sí ' -> 'si'."""
    texto = unicodedata.normalize("NFD", texto.strip().lower())
    return "".join(c for c in texto if unicodedata.category(c) != "Mn")


def siguiente_paso(db: Session, ciudadano_id: int, categoria: str, paso_actual: str | None = None):
    """
    Devuelve el próximo paso de la conversación, o None si ya terminó.
    Se salta lo que ya sabemos del ciudadano (si ya autorizó datos o si
    ya tiene documento registrado, no se le vuelve a preguntar).
    """
    pasos = ["consentimiento", "tipo_documento", "numero_documento"]
    pasos += DOCUMENTOS_POR_CATEGORIA[categoria]
    inicio = pasos.index(paso_actual) + 1 if paso_actual else 0

    ciudadano = db.execute(
        text("SELECT acepta_tratamiento_datos, numero_documento FROM ciudadano WHERE id = :id"),
        {"id": ciudadano_id},
    ).mappings().one()

    for paso in pasos[inicio:]:
        if paso == "consentimiento" and ciudadano["acepta_tratamiento_datos"]:
            continue
        if paso in ("tipo_documento", "numero_documento") and ciudadano["numero_documento"]:
            continue
        return paso
    return None


def guardar_paso(db: Session, ciudadano_id: int, mensaje_id: int, paso: str) -> None:
    db.execute(
        text(
            """
            INSERT INTO conversacion (ciudadano_id, paso, mensaje_id)
            VALUES (:cid, :paso, :mid)
            ON CONFLICT (ciudadano_id) DO UPDATE
            SET paso = EXCLUDED.paso,
                mensaje_id = EXCLUDED.mensaje_id,
                actualizado_en = now()
            """
        ),
        {"cid": ciudadano_id, "paso": paso, "mid": mensaje_id},
    )


def borrar_conversacion(db: Session, ciudadano_id: int) -> None:
    db.execute(text("DELETE FROM conversacion WHERE ciudadano_id = :cid"), {"cid": ciudadano_id})


def mensaje_final(mensaje_id: int) -> str:
    return (
        f"¡Listo! Tu caso quedó registrado con el número *#{mensaje_id}*. "
        "Un funcionario de la alcaldía lo va a revisar y te escribirá por "
        "este mismo chat con los avances."
    )




def registrar_caso_nuevo(db: Session, ciudadano_id: int, texto_ciudadano: str) -> str:
        
    historial = db.execute(
        text(
            """
            SELECT coalesce(texto_original, resumen)
            FROM mensaje
            WHERE ciudadano_id = :cid
              AND creado_en > now() - interval '2 hours'
            ORDER BY creado_en DESC
            LIMIT 5
            """
        ),
        {"cid": ciudadano_id},
    ).scalars().all()

    resultado = clasificar_y_responder(texto_ciudadano, list(reversed(historial)))
        
    mensaje_id = db.execute(
        text(
            """
            INSERT INTO mensaje (ciudadano_id, tipo, categoria, urgencia, resumen, estado, texto_original)
            VALUES (:ciudadano_id, :tipo, :categoria, :urgencia, :resumen, :estado, :texto_original)
            RETURNING id
            """
        ),
        {
            "ciudadano_id": ciudadano_id,
            "tipo": resultado["tipo"],
            "categoria": resultado["categoria"],
            "urgencia": resultado["urgencia"],
            "resumen": resultado["resumen"],
            "estado": "resuelto" if resultado["resuelto"] else "por_revisar",
            "texto_original": texto_ciudadano,
        },
    ).scalar()

    if resultado["resuelto"]:
        db.execute(text("INSERT INTO resuelto (mensaje_id) VALUES (:id)"), {"id": mensaje_id})
    else:
        db.execute(text("INSERT INTO por_revisar (mensaje_id) VALUES (:id)"), {"id": mensaje_id})

    respuesta = resultado["respuesta"]

    if resultado["categoria"] in DOCUMENTOS_POR_CATEGORIA and not resultado["resuelto"]:
        paso = siguiente_paso(db, ciudadano_id, resultado["categoria"])
        if paso:
            guardar_paso(db, ciudadano_id, mensaje_id, paso)
            respuesta += "\n\n" + PREGUNTAS[paso]

    return respuesta



def atender_paso(db: Session, ciudadano_id: int, conversacion: dict, texto: str, documento_wa: dict | None) -> str:
    paso = conversacion["paso"]
    mensaje_id = conversacion["mensaje_id"]
    categoria = conversacion["categoria"]
    respuesta = limpiar(texto)
    aviso = ""

    if paso == "consentimiento":
        if respuesta in ("si", "s"):
            db.execute(
                text(
                    "UPDATE ciudadano SET acepta_tratamiento_datos = true, "
                    "fecha_aceptacion = now() WHERE id = :id"
                ),
                {"id": ciudadano_id},
            )
        elif respuesta in ("no", "n"):
            borrar_conversacion(db, ciudadano_id)
            return (
                "Entendido. Sin tu autorización no podemos recibir tus documentos, "
                "pero tu caso quedó registrado y un funcionario de la alcaldía lo va a revisar."
            )
        else:
            return "No te entendí.\n\n" + PREGUNTAS[paso]

    elif paso == "tipo_documento":
        tipo = TIPOS_IDENTIFICACION.get(respuesta)
        if not tipo:
            return "Responde solo con el número de la opción.\n\n" + PREGUNTAS[paso]
        db.execute(
            text("UPDATE ciudadano SET tipo_identificacion = :tipo WHERE id = :id"),
            {"tipo": tipo, "id": ciudadano_id},
        )

    elif paso == "numero_documento":
        numero_doc = re.sub(r"[\s.\-]", "", texto).upper()
        if not re.fullmatch(r"[0-9A-Z]{4,15}", numero_doc):
            return "Ese número no parece válido.\n\n" + PREGUNTAS[paso]

        ya_existe = db.execute(
            text("SELECT id FROM ciudadano WHERE numero_documento = :n AND id <> :id"),
            {"n": numero_doc, "id": ciudadano_id},
        ).scalar()

        if ya_existe:
            aviso = (
                "Ese número de documento ya está registrado con otro WhatsApp. "
                "Un funcionario lo va a verificar. Sigamos con tu caso.\n\n"
            )
        else:
            db.execute(
                text("UPDATE ciudadano SET numero_documento = :n WHERE id = :id"),
                {"n": numero_doc, "id": ciudadano_id},
            )

    else:
        
        if documento_wa:
            try:
                ruta, tamano = descargar_pdf(documento_wa["id"])
            except ValueError as error:
                if str(error) == "muy_grande":
                    return "Ese archivo pesa más de 10 MB. Intenta con uno más liviano."
                return "Ese archivo no es un PDF. Envíalo en formato PDF, por favor."
            except Exception as error:
                print(f"[DEBUG] Error descargando PDF: {error!r}")
                return "No pude recibir el archivo. Intenta enviarlo de nuevo."

            db.execute(
                text(
                    """
                    INSERT INTO documento_adjunto
                        (mensaje_id, tipo, nombre_original, ruta_archivo, tamano_bytes)
                    VALUES (:mid, :tipo, :nombre, :ruta, :tam)
                    """
                ),
                {
                    "mid": mensaje_id,
                    "tipo": paso,
                    "nombre": documento_wa.get("filename", "documento.pdf"),
                    "ruta": ruta,
                    "tam": tamano,
                },
            )
        elif respuesta not in ("no tengo", "notengo"):
            return "Necesito el archivo en PDF, o escribe *NO TENGO*.\n\n" + PREGUNTAS[paso]

    
    siguiente = siguiente_paso(db, ciudadano_id, categoria, paso)
    if siguiente:
        guardar_paso(db, ciudadano_id, mensaje_id, siguiente)
        return aviso + PREGUNTAS[siguiente]

    borrar_conversacion(db, ciudadano_id)
    return aviso + mensaje_final(mensaje_id)



def buscar_caso_abierto(db: Session, ciudadano_id: int):
    
    return db.execute(
        text(
            """
            SELECT pr.mensaje_id
            FROM por_revisar pr
            JOIN mensaje m ON m.id = pr.mensaje_id
            WHERE m.ciudadano_id = :cid
              AND pr.estado_tramite <> 'cerrado'
            ORDER BY m.creado_en DESC
            LIMIT 1
            """
        ),
        {"cid": ciudadano_id},
    ).scalar()


def registrar_respuesta(db: Session, caso_id: int, texto: str, documento_wa: dict | None):
    
    adjunto_id = None

    if documento_wa:
        try:
            ruta, tamano = descargar_pdf(documento_wa["id"])
        except ValueError as error:
            if str(error) == "muy_grande":
                return "Ese archivo pesa más de 10 MB. Intenta con uno más liviano."
            return "Solo podemos recibir archivos en PDF."
        except Exception as error:
            print(f"[DEBUG] Error descargando PDF: {error!r}")
            return "No pude recibir el archivo. Intenta enviarlo de nuevo."

        nombre = documento_wa.get("filename", "documento.pdf")
        adjunto_id = db.execute(
            text(
                """
                INSERT INTO documento_adjunto
                    (mensaje_id, tipo, nombre_original, ruta_archivo, tamano_bytes)
                VALUES (:mid, 'otro', :nombre, :ruta, :tam)
                RETURNING id
                """
            ),
            {"mid": caso_id, "nombre": nombre, "ruta": ruta, "tam": tamano},
        ).scalar()
        texto = documento_wa.get("caption") or f"[Envió el PDF: {nombre}]"

    elif not texto:
        return "Por ahora solo puedo recibir mensajes de texto y archivos PDF."

  
    reciente = db.execute(
        text(
            "SELECT 1 FROM respuesta_ciudadano "
            "WHERE mensaje_id = :mid AND recibido_en > now() - interval '1 hour' LIMIT 1"
        ),
        {"mid": caso_id},
    ).scalar()

    db.execute(
        text(
            "INSERT INTO respuesta_ciudadano (mensaje_id, texto, adjunto_id) "
            "VALUES (:mid, :texto, :adj)"
        ),
        {"mid": caso_id, "texto": texto, "adj": adjunto_id},
    )

    if adjunto_id:
        return f"Recibimos tu PDF y lo agregamos a tu caso *#{caso_id}*."
    if reciente:
        return None
    return (
        f"Tu mensaje quedó agregado a tu caso *#{caso_id}*. El funcionario "
        "que lo atiende lo va a ver y te responderá por este chat."
    )

# Mensajes del funcionario al ciudadano


def enviar_al_ciudadano(db: Session, caso_id: int, texto: str) -> dict:
    
    datos = db.execute(
        text(
            """
            SELECT c.telefono,
                   coalesce(c.ultimo_mensaje_en > now() - interval '24 hours', false) AS en_ventana
            FROM mensaje m
            JOIN ciudadano c ON c.id = m.ciudadano_id
            WHERE m.id = :id
            """
        ),
        {"id": caso_id},
    ).mappings().one()

    if datos["en_ventana"]:
        return enviar_mensaje(datos["telefono"], f"*Caso #{caso_id}*\n\n{texto}")
    return enviar_plantilla_avance(datos["telefono"], caso_id, texto)


def guardar_seguimiento(db: Session, caso_id: int, funcionario_id: int, texto: str, enviar: bool) -> dict:
    
    seguimiento_id = db.execute(
        text(
            """
            INSERT INTO seguimiento
                (mensaje_id, funcionario_id, descripcion, enviar_ciudadano, estado_envio)
            VALUES (:mid, :fid, :texto, :enviar, :estado)
            RETURNING id
            """
        ),
        {
            "mid": caso_id, "fid": funcionario_id, "texto": texto,
            "enviar": enviar, "estado": "pendiente" if enviar else None,
        },
    ).scalar()
    db.commit()

    if not enviar:
        return {"id": seguimiento_id, "estado_envio": None, "error": None}

    envio = enviar_al_ciudadano(db, caso_id, texto)
    estado = "enviado" if envio["ok"] else "fallido"

    db.execute(
        text(
            """
            UPDATE seguimiento
            SET estado_envio = :estado, whatsapp_message_id = :wid, error_envio = :error
            WHERE id = :id
            """
        ),
        {"estado": estado, "wid": envio["id"], "error": envio["error"], "id": seguimiento_id},
    )
    db.commit()

    return {"id": seguimiento_id, "estado_envio": estado, "error": envio["error"]}

@app.get("/")
def inicio():
    return {"mensaje": "API de la alcaldía funcionando"}


@app.get("/salud-bd")
def salud_bd(db: Session = Depends(get_db)):
    total = db.execute(text("SELECT count(*) FROM mensaje")).scalar()
    return {"base_de_datos": "conectada", "mensajes_guardados": total}


@app.get("/webhook")
def verificar_webhook(request: Request):
    modo = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    if modo == "subscribe" and token == VERIFY_TOKEN:
        return Response(content=challenge, media_type="text/plain")
    return Response(content="Token de verificación inválido", status_code=403)


@app.post("/webhook")
async def recibir_mensaje(request: Request, db: Session = Depends(get_db)):
    datos = await request.json()

    try:
        valor = datos["entry"][0]["changes"][0]["value"]
        mensaje_whatsapp = valor["messages"][0]
        contacto = valor["contacts"][0]
    except (KeyError, IndexError):
        return {"status": "ignorado"}

    numero = mensaje_whatsapp["from"]
    nombre = contacto.get("profile", {}).get("name")
    tipo_wa = mensaje_whatsapp.get("type")
    texto_ciudadano = mensaje_whatsapp.get("text", {}).get("body", "") if tipo_wa == "text" else ""
    documento_wa = mensaje_whatsapp.get("document") if tipo_wa == "document" else None

    
    ciudadano_id = db.execute(
        text("SELECT id FROM ciudadano WHERE telefono = :telefono"),
        {"telefono": numero},
    ).scalar()

    if ciudadano_id is None:
        ciudadano_id = db.execute(
            text("INSERT INTO ciudadano (telefono, nombre) VALUES (:telefono, :nombre) RETURNING id"),
            {"telefono": numero, "nombre": nombre},
        ).scalar()
    db.execute(
        text("UPDATE ciudadano SET ultimo_mensaje_en = now() WHERE id = :id"),
        {"id": ciudadano_id},
    )
   
    conversacion = db.execute(
        text(
            """
            SELECT c.paso, c.mensaje_id, m.categoria
            FROM conversacion c
            JOIN mensaje m ON m.id = c.mensaje_id
            WHERE c.ciudadano_id = :cid
              AND c.actualizado_en > now() - interval '24 hours'
            """
        ),
        {"cid": ciudadano_id},
    ).mappings().first()

    if conversacion:
        respuesta = atender_paso(db, ciudadano_id, dict(conversacion), texto_ciudadano, documento_wa)
    else:
        borrar_conversacion(db, ciudadano_id)  
        caso_abierto = buscar_caso_abierto(db, ciudadano_id)

        if caso_abierto:
            
            respuesta = registrar_respuesta(db, caso_abierto, texto_ciudadano, documento_wa)
        elif texto_ciudadano:
            
            respuesta = registrar_caso_nuevo(db, ciudadano_id, texto_ciudadano)
        else:
            respuesta = (
                "Hola, soy el asistente de la Alcaldía de Río de Oro. "
                "Cuéntame por escrito en qué te podemos ayudar."
            )

    db.commit()

    if respuesta:
        enviar_mensaje(numero, respuesta)

    return {"status": "procesado"}

# ---------------------------------------------------------------------
# Sesión del funcionario
# ---------------------------------------------------------------------

class DatosLogin(BaseModel):
    usuario: str
    password: str
    recordarme: bool = False


@app.post("/api/auth/login")
def login(datos: DatosLogin, request: Request, response: Response, db: Session = Depends(get_db)):
    usuario = datos.usuario.strip().lower()
    ip = request.client.host if request.client else "desconocida"
    claves = [f"usuario:{usuario}", f"ip:{ip}"]

    if any(bloqueado(c) for c in claves):
        raise ErrorApi(429, "Demasiados intentos fallidos. Espera 15 minutos.", "demasiados_intentos")

    funcionario = db.execute(
        text(
            """
            SELECT id, usuario, activo, password_hash,
                   concat_ws(' ', nombre1, nombre2, apellido_1, apellido_2) AS nombre_completo
            FROM funcionario
            WHERE usuario = :u AND activo = true
            """
        ),
        {"u": usuario},
    ).mappings().first()

    if not funcionario or not verificar_password(datos.password, funcionario["password_hash"]):
        for c in claves:
            registrar_fallo(c)
        raise ErrorApi(401, "Usuario o contraseña incorrectos.", "credenciales_invalidas")

    for c in claves:
        limpiar_intentos(c)

    token, csrf, expira = crear_sesion(db, funcionario["id"], datos.recordarme, request)
    poner_cookie(response, token, expira, datos.recordarme)

    return {"funcionario": datos_publicos(funcionario), "csrf_token": csrf}


@app.get("/api/auth/me")
def sesion_actual(funcionario: dict = Depends(funcionario_actual)):
    """El front la llama al cargar la página para saber si hay sesión."""
    return {"funcionario": datos_publicos(funcionario), "csrf_token": funcionario["csrf_token"]}


@app.post("/api/auth/logout")
def logout(
    response: Response,
    token: str | None = Depends(esquema_cookie),
    db: Session = Depends(get_db),
):
    if token:
        db.execute(
            text("UPDATE sesion SET revocada = true WHERE token_hash = :hash"),
            {"hash": hash_token(token)},
        )
        db.commit()
    borrar_cookie(response)
    return {"ok": True}


# ---------------------------------------------------------------------
# Bandeja de casos
# ---------------------------------------------------------------------

ESTADOS_FILTRO = {
    "abiertos": "pr.estado_tramite <> 'cerrado'",
    "recibido": "pr.estado_tramite = 'recibido'",
    "en_tramite": "pr.estado_tramite = 'en_tramite'",
    "cerrado": "pr.estado_tramite = 'cerrado'",
    "cerrados": "pr.estado_tramite = 'cerrado'",
    "todos": None,
}

ORDENES = {
    "urgencia": "m.urgencia DESC, m.creado_en ASC",
    "recientes": "m.creado_en DESC",
    "resolucion": "pr.fecha_resuelto DESC NULLS LAST, m.id DESC",
}

DESDE_CASOS = """
    FROM por_revisar pr
    JOIN mensaje m ON m.id = pr.mensaje_id
    JOIN ciudadano c ON c.id = m.ciudadano_id
    LEFT JOIN funcionario f ON f.id = pr.funcionario_id
"""


def armar_where(filtros: list[str]) -> str:
    return ("WHERE " + " AND ".join(filtros)) if filtros else ""


@app.get("/api/casos")
def listar_casos(
    estado: str = "abiertos",
    tipo: str | None = None,
    categoria: str | None = None,
    urgencia: str | None = None,
    asignacion: str = "todos",
    q: str | None = None,
    orden: str = "urgencia",
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=50),
    db: Session = Depends(get_db),
    funcionario: dict = Depends(funcionario_actual),
):
    """
    Bandeja paginada. Todo el filtrado y orden lo hace PostgreSQL.
    Devuelve: items, total, page, page_size, pages, conteo_por_tipo.
    """
    if estado not in ESTADOS_FILTRO:
        raise ErrorApi(400, "Estado no válido.", "filtro_invalido")
    if orden not in ORDENES:
        raise ErrorApi(400, "Orden no válido.", "filtro_invalido")

    filtros = []
    params = {}

    if ESTADOS_FILTRO[estado]:
        filtros.append(ESTADOS_FILTRO[estado])

    if categoria:
        if categoria not in CATEGORIAS:
            raise ErrorApi(400, "Categoría no válida.", "filtro_invalido")
        filtros.append("m.categoria = :categoria")
        params["categoria"] = categoria

    if urgencia:
        if urgencia not in URGENCIAS:
            raise ErrorApi(400, "Urgencia no válida.", "filtro_invalido")
        filtros.append("m.urgencia = :urgencia")
        params["urgencia"] = urgencia

    if asignacion == "mios":
        filtros.append("pr.funcionario_id = :yo")
        params["yo"] = funcionario["id"]
    elif asignacion == "sin_asignar":
        filtros.append("pr.funcionario_id IS NULL")
    elif asignacion != "todos":
        raise ErrorApi(400, "Asignación no válida.", "filtro_invalido")

    # Búsqueda libre: nombre, documento, teléfono, texto o número del caso
    texto = (q or "").strip()[:100]
    if texto:
        # Se escapan % y _ para que se busquen como letras normales
        escapado = texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        params["q"] = f"%{escapado}%"
        condiciones = [
            "c.nombre ILIKE :q",
            "c.numero_documento ILIKE :q",
            "c.telefono ILIKE :q",
            "m.resumen ILIKE :q",
            "m.texto_original ILIKE :q",
        ]
        numero = texto.lstrip("#")
        if numero.isdigit() and len(numero) <= 9:
            condiciones.append("m.id = :q_id")
            params["q_id"] = int(numero)
        filtros.append("(" + " OR ".join(condiciones) + ")")

    # Conteo por tipo para las pestañas (con todos los filtros menos el tipo)
    conteo = db.execute(
        text(f"SELECT m.tipo, count(*) AS total {DESDE_CASOS} {armar_where(filtros)} GROUP BY m.tipo"),
        params,
    ).mappings().all()
    conteo_por_tipo = {f["tipo"]: f["total"] for f in conteo}

    if tipo:
        if tipo not in TIPOS:
            raise ErrorApi(400, "Tipo no válido.", "filtro_invalido")
        filtros.append("m.tipo = :tipo")
        params["tipo"] = tipo

    where = armar_where(filtros)

    total = db.execute(text(f"SELECT count(*) {DESDE_CASOS} {where}"), params).scalar()
    pages = max(1, -(-total // page_size))  # división redondeando hacia arriba
    page = min(page, pages)

    filas = db.execute(
        text(
            f"""
            SELECT m.id, m.tipo, m.categoria, m.urgencia, m.resumen, m.creado_en,
                   pr.estado_tramite, pr.fecha_resuelto, pr.funcionario_id,
                   f.nombre1 || ' ' || f.apellido_1 AS funcionario,
                   c.nombre AS ciudadano, c.numero_documento,
                   (SELECT count(*) FROM documento_adjunto d
                     WHERE d.mensaje_id = m.id) AS total_adjuntos,
                   coalesce(
                     (SELECT ch.autor FROM chat_caso ch
                       WHERE ch.mensaje_id = m.id
                       ORDER BY ch.fecha DESC LIMIT 1) = 'ciudadano',
                     false
                   ) AS respuesta_pendiente
            {DESDE_CASOS}
            {where}
            ORDER BY {ORDENES[orden]}
            LIMIT :limite OFFSET :desde
            """
        ),
        {**params, "limite": page_size, "desde": (page - 1) * page_size},
    ).mappings().all()

    return {
        "items": [dict(f) for f in filas],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
        "conteo_por_tipo": conteo_por_tipo,
    }

@app.get("/api/casos/{caso_id}")
def ver_caso(
    caso_id: int,
    db: Session = Depends(get_db),
    funcionario: dict = Depends(funcionario_actual),
):
    
    fila = db.execute(
        text(
            """
            SELECT m.id, m.tipo, m.categoria, m.urgencia, m.resumen,
                   m.texto_original, m.creado_en,
                   pr.estado_tramite, pr.fecha_resuelto, pr.funcionario_id,
                   f.nombre1 || ' ' || f.apellido_1 AS funcionario,
                   c.id AS ciudadano_id, c.nombre AS ciudadano, c.telefono,
                   c.tipo_identificacion, c.numero_documento,
                   c.acepta_tratamiento_datos, c.ultimo_mensaje_en,
                   coalesce(c.ultimo_mensaje_en > now() - interval '24 hours', false)
                     AS ventana_whatsapp_abierta
            FROM por_revisar pr
            JOIN mensaje m ON m.id = pr.mensaje_id
            JOIN ciudadano c ON c.id = m.ciudadano_id
            LEFT JOIN funcionario f ON f.id = pr.funcionario_id
            WHERE m.id = :id
            """
        ),
        {"id": caso_id},
    ).mappings().first()

    if not fila:
        raise ErrorApi(404, "El caso no existe.", "caso_no_encontrado")

    caso = dict(fila)
    caso["es_mio"] = caso["funcionario_id"] == funcionario["id"]
    caso["puede_modificar"] = caso["es_mio"] and caso["estado_tramite"] != "cerrado"

    adjuntos = []
    for a in db.execute(
        text(
            """
            SELECT id, tipo, nombre_original, tamano_bytes, subido_en, ruta_archivo
            FROM documento_adjunto
            WHERE mensaje_id = :id
            ORDER BY subido_en
            """
        ),
        {"id": caso_id},
    ).mappings().all():
        doc = dict(a)
        ruta = doc.pop("ruta_archivo")  # la ruta del servidor nunca sale al front
        doc["tipo_etiqueta"] = ETIQUETAS_ADJUNTO.get(doc["tipo"], "Documento")
        doc["disponible"] = ruta_segura(ruta) is not None
        adjuntos.append(doc)

    chat = db.execute(
        text(
            """
            SELECT ch.id, ch.fecha, ch.autor, ch.texto, ch.enviar_ciudadano,
                   ch.estado_envio, ch.error_envio, ch.adjunto_id,
                   f.nombre1 || ' ' || f.apellido_1 AS funcionario
            FROM chat_caso ch
            LEFT JOIN funcionario f ON f.id = ch.funcionario_id
            WHERE ch.mensaje_id = :id
            ORDER BY ch.fecha
            """
        ),
        {"id": caso_id},
    ).mappings().all()

    return {"caso": caso, "adjuntos": adjuntos, "chat": [dict(c) for c in chat]}
# ---------------------------------------------------------------------
# Asignación de casos
# ---------------------------------------------------------------------

def estado_del_caso(db: Session, caso_id: int) -> dict:
    fila = db.execute(
        text("SELECT estado_tramite, funcionario_id FROM por_revisar WHERE mensaje_id = :id"),
        {"id": caso_id},
    ).mappings().first()
    if not fila:
        raise ErrorApi(404, "El caso no existe.", "caso_no_encontrado")
    return dict(fila)


@app.post("/api/casos/{caso_id}/tomar")
def tomar_caso(
    caso_id: int,
    db: Session = Depends(get_db),
    funcionario: dict = Depends(funcionario_actual),
):
    """Asigna el caso al funcionario. Si dos lo toman a la vez, solo uno gana."""
    asignado = db.execute(
        text(
            """
            UPDATE por_revisar
            SET funcionario_id = :fid
            WHERE mensaje_id = :id
              AND funcionario_id IS NULL
              AND estado_tramite <> 'cerrado'
            RETURNING mensaje_id
            """
        ),
        {"fid": funcionario["id"], "id": caso_id},
    ).scalar()

    if asignado:
        db.commit()
        return {"ok": True, "funcionario_id": funcionario["id"]}

    # No se pudo: se averigua por qué
    caso = estado_del_caso(db, caso_id)
    if caso["estado_tramite"] == "cerrado":
        raise ErrorApi(409, "El caso ya está cerrado.", "caso_cerrado")
    if caso["funcionario_id"] == funcionario["id"]:
        raise ErrorApi(409, "Este caso ya es tuyo.", "sin_cambios")
    raise ErrorApi(409, "Otro funcionario tomó este caso primero.", "caso_ya_asignado")



@app.post("/api/casos/{caso_id}/liberar")
def liberar_caso(
    caso_id: int,
    db: Session = Depends(get_db),
    funcionario: dict = Depends(funcionario_actual),
):
    """Devuelve el caso a la bandeja. Solo lo puede hacer quien lo tiene."""
    liberado = db.execute(
        text(
            """
            UPDATE por_revisar
            SET funcionario_id = NULL
            WHERE mensaje_id = :id
              AND funcionario_id = :fid
              AND estado_tramite <> 'cerrado'
            RETURNING mensaje_id
            """
        ),
        {"fid": funcionario["id"], "id": caso_id},
    ).scalar()

    if liberado:
        db.commit()
        return {"ok": True}

    caso = estado_del_caso(db, caso_id)
    if caso["estado_tramite"] == "cerrado":
        raise ErrorApi(409, "El caso ya está cerrado.", "caso_cerrado")
    if caso["funcionario_id"] is None:
        raise ErrorApi(409, "El caso no está asignado a nadie.", "sin_cambios")
    raise ErrorApi(403, "Este caso está asignado a otro funcionario.", "caso_de_otro_funcionario")
# ---------------------------------------------------------------------
# Permisos y documentos
# ---------------------------------------------------------------------

ETIQUETAS_ADJUNTO = {
    "orden_medica": "Orden médica",
    "historia_clinica": "Historia clínica",
    "documento_identidad": "Documento de identidad",
    "otro": "Otro documento",
}


def verificar_permiso(db: Session, caso_id: int, funcionario_id: int, permitir_cerrado: bool = False) -> dict:
    """
    Solo el funcionario que tiene el caso puede responder o cambiar el estado.
    Un caso cerrado se puede reabrir si era suyo o si no era de nadie.
    """
    caso = estado_del_caso(db, caso_id)
    cerrado = caso["estado_tramite"] == "cerrado"

    if cerrado and not permitir_cerrado:
        raise ErrorApi(409, "El caso ya está cerrado.", "caso_cerrado")
    if caso["funcionario_id"] is None and not cerrado:
        raise ErrorApi(409, "Primero toma el caso para poder responderlo.", "caso_sin_asignar")
    if caso["funcionario_id"] not in (None, funcionario_id):
        raise ErrorApi(403, "Este caso está asignado a otro funcionario.", "caso_de_otro_funcionario")
    return caso


def ruta_segura(ruta_archivo: str) -> Path | None:
    """Devuelve la ruta solo si el archivo existe y está dentro de la carpeta de adjuntos."""
    ruta = Path(ruta_archivo).resolve()
    if CARPETA_ADJUNTOS.resolve() not in ruta.parents or not ruta.is_file():
        return None
    return ruta

@app.get("/api/adjuntos/{adjunto_id}")
def descargar_adjunto(
    adjunto_id: int,
    request: Request,
    modo: str = "descargar",
    db: Session = Depends(get_db),
    funcionario: dict = Depends(funcionario_actual),
):
    """
    modo=ver: el navegador lo muestra en una pestaña.
    modo=descargar: se baja con su nombre original.
    """
    if modo not in ("ver", "descargar"):
        raise ErrorApi(400, "Modo no válido.", "modo_invalido")

    adjunto = db.execute(
        text("SELECT nombre_original, ruta_archivo FROM documento_adjunto WHERE id = :id"),
        {"id": adjunto_id},
    ).mappings().first()
    if not adjunto:
        raise ErrorApi(404, "El documento no existe.", "documento_no_encontrado")

    ruta = ruta_segura(adjunto["ruta_archivo"])
    if not ruta:
        raise ErrorApi(404, "El archivo no está disponible en el servidor.", "archivo_no_disponible")

    with ruta.open("rb") as archivo:
        if archivo.read(4) != b"%PDF":
            raise ErrorApi(422, "El archivo está dañado o no es un PDF.", "archivo_invalido")

    # Queda registrado quién lo abrió y cuándo
    db.execute(
        text(
            """
            INSERT INTO acceso_documento (adjunto_id, funcionario_id, modo, ip)
            VALUES (:aid, :fid, :modo, :ip)
            """
        ),
        {
            "aid": adjunto_id,
            "fid": funcionario["id"],
            "modo": modo,
            "ip": request.client.host if request.client else None,
        },
    )
    db.commit()

    return FileResponse(
        ruta,
        media_type="application/pdf",
        filename=adjunto["nombre_original"],
        content_disposition_type="inline" if modo == "ver" else "attachment",
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )

class DatosSeguimiento(BaseModel):
    texto: str
    enviar_ciudadano: bool = True


@app.post("/api/casos/{caso_id}/seguimiento")
def agregar_seguimiento(
    caso_id: int,
    datos: DatosSeguimiento,
    db: Session = Depends(get_db),
    funcionario: dict = Depends(funcionario_actual),
):
    """El funcionario responde. Con enviar_ciudadano=false queda como observación interna."""
    texto = datos.texto.strip()
    if not texto:
        raise ErrorApi(400, "El mensaje está vacío.", "mensaje_vacio")
    if len(texto) > 900:
        raise ErrorApi(400, "El mensaje puede tener máximo 900 caracteres.", "mensaje_largo")

    verificar_permiso(db, caso_id, funcionario["id"])

    # La primera respuesta pasa el caso de 'Pendiente' a 'En proceso'
    db.execute(
        text(
            """
            UPDATE por_revisar
            SET estado_tramite = 'en_tramite'
            WHERE mensaje_id = :id AND estado_tramite = 'recibido'
            """
        ),
        {"id": caso_id},
    )

    return guardar_seguimiento(db, caso_id, funcionario["id"], texto, datos.enviar_ciudadano)

class DatosEstado(BaseModel):
    estado: str
    mensaje: str | None = None
    notificar_ciudadano: bool = True


ESTADOS_TRAMITE = {"recibido", "en_tramite", "cerrado"}
MENSAJE_CIERRE = (
    "Tu caso fue cerrado por la alcaldía. Si el problema continúa, "
    "escríbenos de nuevo por este chat y abrimos un caso nuevo."
)


@app.patch("/api/casos/{caso_id}/estado")
def cambiar_estado(
    caso_id: int,
    datos: DatosEstado,
    db: Session = Depends(get_db),
    funcionario: dict = Depends(funcionario_actual),
):
    """
    Cambia el estado del trámite, incluido reabrir un caso cerrado.
    Si hay mensaje (o se está cerrando), se guarda en el chat y,
    si notificar_ciudadano es true, se manda por WhatsApp.
    """
    if datos.estado not in ESTADOS_TRAMITE:
        raise ErrorApi(400, "Estado no válido.", "estado_invalido")

    caso = verificar_permiso(db, caso_id, funcionario["id"], permitir_cerrado=True)
    if caso["estado_tramite"] == datos.estado:
        raise ErrorApi(409, "El caso ya está en ese estado.", "sin_cambios")

    db.execute(
        text(
            """
            UPDATE por_revisar
            SET estado_tramite = :estado,
                fecha_resuelto = CASE WHEN :estado = 'cerrado' THEN now() ELSE NULL END,
                funcionario_id = :fid
            WHERE mensaje_id = :id
            """
        ),
        {"estado": datos.estado, "fid": funcionario["id"], "id": caso_id},
    )

    if datos.estado == "cerrado":
        # Si el ciudadano estaba a mitad del paso a paso de documentos, se corta
        db.execute(text("DELETE FROM conversacion WHERE mensaje_id = :id"), {"id": caso_id})

    db.commit()

    texto = (datos.mensaje or "").strip()[:900]
    if datos.estado == "cerrado" and not texto and datos.notificar_ciudadano:
        texto = MENSAJE_CIERRE

    aviso = None
    if texto:
        aviso = guardar_seguimiento(db, caso_id, funcionario["id"], texto, datos.notificar_ciudadano)

    return {"estado": datos.estado, "aviso": aviso}

@app.get("/api/reportes")
def reportes(
    db: Session = Depends(get_db),
    funcionario: dict = Depends(funcionario_actual),
):
    """Números para el Dashboard y la pantalla de Reportes."""
    totales = db.execute(
        text(
            """
            SELECT
              (SELECT count(*) FROM mensaje)  AS total_mensajes,
              (SELECT count(*) FROM resuelto) AS resueltos_por_ia,
              count(*) AS total_casos,
              count(*) FILTER (WHERE estado_tramite = 'recibido')   AS pendientes,
              count(*) FILTER (WHERE estado_tramite = 'en_tramite') AS en_tramite,
              count(*) FILTER (WHERE estado_tramite = 'cerrado')    AS cerrados,
              count(*) FILTER (WHERE estado_tramite <> 'cerrado' AND funcionario_id IS NULL) AS sin_asignar,
              count(*) FILTER (WHERE fecha_resuelto >= date_trunc('month', now())) AS cerrados_este_mes
            FROM por_revisar
            """
        )
    ).mappings().one()

    def agrupar(columna: str, solo_abiertos: bool = False):
        filtro = "WHERE pr.estado_tramite <> 'cerrado'" if solo_abiertos else ""
        return [
            dict(f)
            for f in db.execute(
                text(
                    f"""
                    SELECT m.{columna}, count(*) AS total
                    FROM por_revisar pr
                    JOIN mensaje m ON m.id = pr.mensaje_id
                    {filtro}
                    GROUP BY m.{columna}
                    ORDER BY total DESC
                    """
                )
            ).mappings().all()
        ]

    recientes = db.execute(
        text(
            """
            SELECT m.id, m.tipo, m.urgencia, m.creado_en, pr.estado_tramite,
                   c.nombre AS ciudadano
            FROM por_revisar pr
            JOIN mensaje m ON m.id = pr.mensaje_id
            JOIN ciudadano c ON c.id = m.ciudadano_id
            ORDER BY m.creado_en DESC
            LIMIT 5
            """
        )
    ).mappings().all()

    return {
        "totales": dict(totales),
        "por_tipo": agrupar("tipo"),
        "por_categoria": agrupar("categoria"),
        "abiertos_por_urgencia": agrupar("urgencia", solo_abiertos=True),
        "recientes": [dict(f) for f in recientes],
    }

@app.get("/api/perfil")
def perfil(
    db: Session = Depends(get_db),
    funcionario: dict = Depends(funcionario_actual),
):
    """Datos del funcionario que inició sesión y su actividad."""
    actividad = db.execute(
        text(
            """
            SELECT
              (SELECT count(*) FROM por_revisar
                WHERE funcionario_id = :fid AND estado_tramite <> 'cerrado') AS casos_abiertos,
              (SELECT count(*) FROM por_revisar
                WHERE funcionario_id = :fid AND estado_tramite = 'cerrado')  AS casos_cerrados,
              (SELECT count(*) FROM seguimiento
                WHERE funcionario_id = :fid)                                  AS seguimientos_registrados
            """
        ),
        {"fid": funcionario["id"]},
    ).mappings().one()

    return {
        "funcionario": datos_publicos(funcionario),
        "sesion_expira_en": funcionario["expira_en"],
        "actividad": dict(actividad),
    }