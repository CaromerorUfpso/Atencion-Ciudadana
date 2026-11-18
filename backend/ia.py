
import json
import os
import holidays
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Valores permitidos (deben coincidir con los ENUM de PostgreSQL)
TIPOS = {"queja", "reclamo", "duda"}
CATEGORIAS = {"cita", "autorizacion", "medicamento", "horario", "otro"}
URGENCIAS = {"baja", "media", "alta", "critica"}

SYSTEM_PROMPT = """
Eres el asistente virtual de atención ciudadana de la Alcaldía de
Río de Oro. Los ciudadanos te escriben por WhatsApp. La gran mayoría
escribe para quejarse de problemas con servicios de salud: citas
médicas, autorizaciones o entrega de medicamentos.

INFORMACIÓN OFICIAL QUE SÍ TIENES:
- Horario de atención de la alcaldía: lunes a viernes, de 7:30 a. m.
  a 12:30 p. m. y de 2:00 p. m. a 5:00 p. m.
- No se atiende sábados, domingos ni días festivos.
- Al final de estas instrucciones te damos la fecha y hora actual
  y qué días son hábiles. Úsalas siempre que pregunten por "hoy",
  "mañana" o un día de la semana. Nunca calcules fechas por tu cuenta.
  - Si saludas, usa el saludo según la hora: "buenos días" antes de
  las 12 m., "buenas tardes" hasta las 6 p. m. y "buenas noches" después.

  A veces te llegan también los mensajes anteriores del mismo ciudadano
de las últimas horas, solo como contexto. Clasifica ÚNICAMENTE el
mensaje nuevo, pero usa los anteriores para entender a qué se refiere.
Por ejemplo, si antes dijo "no me han dado la cita del cardiólogo" y
ahora escribe "ayuda por favor" o "lo de la cita", clasifícalo según
ese problema. Si el ciudadano ya saludó en los mensajes anteriores,
no vuelvas a saludarlo.

Tu trabajo es clasificar el mensaje y decidir qué responder.

1. TIPO:
   - "queja": inconformidad con la atención o el trato recibido.
   - "reclamo": pidió algo (cita, autorización, medicamento, trámite)
     y no se lo dieron, se lo negaron o se lo demoraron.
   - "duda": una pregunta, sin que algo haya salido mal.

2. CATEGORÍA:
   - "cita": problemas para conseguir o con una cita médica.
   - "autorizacion": autorizaciones negadas, demoradas o pendientes
     (exámenes, procedimientos, cirugías, especialistas).
   - "medicamento": medicamentos no entregados, entregados
     incompletos o negados.
   - "horario": preguntas sobre el horario de atención.
   - "otro": cualquier otra cosa.

3. URGENCIA: "baja", "media", "alta" o "critica".
   - "critica": hay riesgo para la vida (por ejemplo, un paciente
     sin un medicamento vital como insulina, anticoagulantes,
     tratamiento de cáncer o VIH, o una cirugía urgente frenada).
   - "alta": salud afectada pero sin riesgo inmediato para la vida.
   - "media": lo normal.
   - "baja": dudas simples o comentarios.

4. RESUELTO:
   Marca "resuelto": true SOLO en estos casos:
   - Un saludo o mensaje de cortesía sin solicitud concreta.
   - Una pregunta sobre cómo funciona este servicio de WhatsApp.
   - Una pregunta sobre el horario de atención (respóndela con la
     información oficial de arriba).
   Para TODO lo demás marca "resuelto": false. Nunca inventes
   direcciones, nombres, plazos, requisitos ni ningún dato que no
   esté en la información oficial.

5. RESPUESTA:
   - Si resuelto es true: responde la pregunta de forma breve y amable.
   - Si la categoría es "cita", "autorizacion" o "medicamento":
     escribe solo un mensaje corto y empático reconociendo el
     problema. NO pidas documentos ni datos; el sistema lo hará
     después automáticamente. No digas todavía que un funcionario
     lo va a contactar.
   - En cualquier otro caso: avisa amablemente que el mensaje fue
     recibido y que una persona de la alcaldía le responderá pronto.
   Escribe en un tono cercano y respetuoso, sin tecnicismos.

Responde ÚNICAMENTE con un JSON válido, sin texto antes ni después:

{
  "tipo": "queja" | "reclamo" | "duda",
  "categoria": "cita" | "autorizacion" | "medicamento" | "horario" | "otro",
  "urgencia": "baja" | "media" | "alta" | "critica",
  "resuelto": true | false,
  "resumen": "resumen breve del mensaje, en una línea",
  "respuesta": "texto que se le envía al ciudadano por WhatsApp"
}
""".strip()

RESPUESTA_POR_DEFECTO = (
    "Recibimos tu mensaje. Una persona del equipo de la alcaldía "
    "te va a responder pronto."
)

ZONA_COLOMBIA = ZoneInfo("America/Bogota")
FESTIVOS = holidays.Colombia()
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def es_dia_habil(dia: date) -> bool:
    """Lunes a viernes y que no sea festivo en Colombia."""
    return dia.weekday() < 5 and dia not in FESTIVOS


def formatear_fecha(dia: date) -> str:
    return f"{DIAS[dia.weekday()]} {dia.day} de {MESES[dia.month - 1]}"


def contexto_fecha() -> str:
    """Le dice a la IA qué día y hora es, y qué días se atiende."""
    ahora = datetime.now(ZONA_COLOMBIA)
    hoy = ahora.date()
    manana = hoy + timedelta(days=1)

    proximo_habil = manana
    while not es_dia_habil(proximo_habil):
        proximo_habil += timedelta(days=1)

    lineas = [
        f"- Ahora en Río de Oro es {formatear_fecha(hoy)} de {hoy.year}, "
        f"a las {ahora:%I:%M %p}.",
        f"- Hoy {'SÍ' if es_dia_habil(hoy) else 'NO'} es día hábil.",
        f"- Mañana, {formatear_fecha(manana)}, "
        f"{'SÍ' if es_dia_habil(manana) else 'NO'} es día hábil.",
        f"- El próximo día hábil después de hoy es el {formatear_fecha(proximo_habil)}.",
    ]
    if hoy in FESTIVOS:
        lineas.append(f"- Hoy es festivo: {FESTIVOS.get(hoy)}.")
    if manana in FESTIVOS:
        lineas.append(f"- Mañana es festivo: {FESTIVOS.get(manana)}.")

    return "FECHA Y HORA ACTUAL (calculadas por el sistema, son exactas):\n" + "\n".join(lineas)

def _normalizar(datos: dict, texto_ciudadano: str) -> dict:
    
    tipo = datos.get("tipo")
    categoria = datos.get("categoria")
    urgencia = datos.get("urgencia")

    return {
        "tipo": tipo if tipo in TIPOS else "queja",
        "categoria": categoria if categoria in CATEGORIAS else "otro",
        "urgencia": urgencia if urgencia in URGENCIAS else "media",
        "resuelto": datos.get("resuelto") is True,
        "resumen": (datos.get("resumen") or texto_ciudadano)[:300],
        "respuesta": datos.get("respuesta") or RESPUESTA_POR_DEFECTO,
    }


def clasificar_y_responder(texto_ciudadano: str, historial: list[str] | None = None) -> dict:
    """
    Le manda el mensaje del ciudadano a Claude y devuelve un diccionario
    con: tipo, categoria, urgencia, resuelto, resumen y respuesta.
    'historial' son los mensajes anteriores del ciudadano (más viejo primero).
    Si algo sale mal, el caso se escala a un funcionario.
    """
    if historial:
        anteriores = "\n".join(f"- {m}" for m in historial)
        contenido = (
            f"MENSAJES ANTERIORES DEL CIUDADANO (solo contexto):\n{anteriores}\n\n"
            f"MENSAJE NUEVO A CLASIFICAR:\n{texto_ciudadano}"
        )
    else:
        contenido = texto_ciudadano

    try:
        mensaje = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=500,
            system=SYSTEM_PROMPT + "\n\n" + contexto_fecha(),
            messages=[{"role": "user", "content": contenido}],
        )
        texto_json = mensaje.content[0].text.strip()

        if texto_json.startswith("```"):
            texto_json = texto_json.strip("`")
            texto_json = texto_json.removeprefix("json").strip()

        datos = json.loads(texto_json)
    except Exception as error:
        print(f"[DEBUG] Falló la IA, se escala el caso: {error!r}")
        datos = {"resuelto": False, "respuesta": RESPUESTA_POR_DEFECTO}

    return _normalizar(datos, texto_ciudadano)


if __name__ == "__main__":
    # Prueba rápida desde la terminal: python ia.py
    ejemplos = [
        "Buenas, ¿a qué hora abren mañana?",
        "Hace 3 semanas me tienen que entregar la insulina y en la farmacia dicen que no hay",
        "Necesito una cita con el cardiólogo y no me la quieren dar",
    ]
    for ejemplo in ejemplos:
        print(ejemplo)
        print(json.dumps(clasificar_y_responder(ejemplo), indent=2, ensure_ascii=False))
        print("-" * 40)