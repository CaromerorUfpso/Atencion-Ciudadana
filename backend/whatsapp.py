
import os
import re
import uuid
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv()

WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")

CARPETA_ADJUNTOS = Path(os.getenv("CARPETA_ADJUNTOS", "adjuntos"))
TAMANO_MAXIMO = 10 * 1024 * 1024  # 10 MB

PLANTILLA_AVANCE = os.getenv("WHATSAPP_PLANTILLA_AVANCE", "actualizacion_caso")
IDIOMA_PLANTILLA = "es_CO"


def _enviar(payload: dict) -> dict:
    """
    Manda cualquier mensaje a la API de Meta y devuelve:
    {"ok": True/False, "id": id_del_mensaje o None, "error": texto o None}
    """
    url = f"https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }

    try:
        respuesta = httpx.post(url, headers=headers, json=payload, timeout=10)
    except httpx.HTTPError as error:
        print(f"[DEBUG] No se pudo conectar con WhatsApp: {error!r}")
        return {"ok": False, "id": None, "error": f"Sin conexión con WhatsApp: {error}"}

    print(f"[DEBUG] Envío a WhatsApp -> status {respuesta.status_code}: {respuesta.text}")

    if respuesta.status_code == 200:
        mensaje_id = respuesta.json().get("messages", [{}])[0].get("id")
        return {"ok": True, "id": mensaje_id, "error": None}
    return {"ok": False, "id": None, "error": respuesta.text[:500]}


def enviar_mensaje(numero_destino: str, texto: str) -> dict:
    
    return _enviar({
        "messaging_product": "whatsapp",
        "to": numero_destino,
        "type": "text",
        "text": {"body": texto},
    })


def enviar_plantilla_avance(numero_destino: str, caso_id: int, texto: str) -> dict:
    
    # Las variables de las plantillas no aceptan saltos de línea,
    # tabulaciones ni muchos espacios seguidos: se dejan en uno solo.
    texto_limpio = re.sub(r"\s+", " ", texto).strip()[:900]

    return _enviar({
        "messaging_product": "whatsapp",
        "to": numero_destino,
        "type": "template",
        "template": {
            "name": PLANTILLA_AVANCE,
            "language": {"code": IDIOMA_PLANTILLA},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": str(caso_id)},
                        {"type": "text", "text": texto_limpio},
                    ],
                }
            ],
        },
    })


def descargar_pdf(media_id: str) -> tuple[str, int]:
    
    headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}"}

    info = httpx.get(
        f"https://graph.facebook.com/v21.0/{media_id}",
        headers=headers,
        timeout=10,
    )
    info.raise_for_status()
    datos = info.json()

    if datos.get("mime_type") != "application/pdf":
        raise ValueError("no_es_pdf")
    if datos.get("file_size", 0) > TAMANO_MAXIMO:
        raise ValueError("muy_grande")

    archivo = httpx.get(datos["url"], headers=headers, timeout=30)
    archivo.raise_for_status()

    if not archivo.content.startswith(b"%PDF"):
        raise ValueError("no_es_pdf")

    CARPETA_ADJUNTOS.mkdir(parents=True, exist_ok=True)
    ruta = CARPETA_ADJUNTOS / f"{uuid.uuid4().hex}.pdf"
    ruta.write_bytes(archivo.content)

    return str(ruta), len(archivo.content)