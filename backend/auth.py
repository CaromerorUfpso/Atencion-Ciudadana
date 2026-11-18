"""
Seguridad de los funcionarios: contraseñas, sesiones con cookie HttpOnly y CSRF.
"""
import hashlib
import os
import secrets
import time
from datetime import datetime, timedelta, timezone

import bcrypt
from dotenv import load_dotenv
from fastapi import Depends, Request, Response
from fastapi.security import APIKeyCookie, APIKeyHeader
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db
from errores import ErrorApi

load_dotenv()

NOMBRE_COOKIE = "sesion"
# En producción (con HTTPS) pon COOKIE_SECURE=true en el .env
COOKIE_SEGURA = os.getenv("COOKIE_SECURE", "false").lower() == "true"
HORAS_SESION = 8      # una jornada laboral
DIAS_RECORDARME = 3   # si marca "Recordarme"

METODOS_SEGUROS = {"GET", "HEAD", "OPTIONS"}


# ---------------------------------------------------------------------
# Contraseñas
# ---------------------------------------------------------------------

def hashear_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verificar_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:  # contraseña de más de 72 bytes u otro dato raro
        return False


# ---------------------------------------------------------------------
# Límite de intentos de inicio de sesión (en memoria)
# ---------------------------------------------------------------------

MAX_INTENTOS = 5
VENTANA_SEGUNDOS = 15 * 60
_intentos: dict[str, list[float]] = {}


def bloqueado(clave: str) -> bool:
    ahora = time.time()
    recientes = [t for t in _intentos.get(clave, []) if ahora - t < VENTANA_SEGUNDOS]
    _intentos[clave] = recientes
    return len(recientes) >= MAX_INTENTOS


def registrar_fallo(clave: str) -> None:
    _intentos.setdefault(clave, []).append(time.time())


def limpiar_intentos(clave: str) -> None:
    _intentos.pop(clave, None)


# ---------------------------------------------------------------------
# Sesiones
# ---------------------------------------------------------------------

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def crear_sesion(db: Session, funcionario_id: int, recordarme: bool, request: Request):
    """Crea la sesión en la base. Devuelve (token, csrf, expira_en)."""
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(32)
    duracion = timedelta(days=DIAS_RECORDARME) if recordarme else timedelta(hours=HORAS_SESION)
    expira = datetime.now(timezone.utc) + duracion

    db.execute(
        text(
            """
            INSERT INTO sesion (funcionario_id, token_hash, csrf_token, expira_en, ip, user_agent)
            VALUES (:fid, :hash, :csrf, :expira, :ip, :ua)
            """
        ),
        {
            "fid": funcionario_id,
            "hash": hash_token(token),
            "csrf": csrf,
            "expira": expira,
            "ip": request.client.host if request.client else None,
            "ua": (request.headers.get("user-agent") or "")[:255],
        },
    )
    db.commit()
    return token, csrf, expira


def poner_cookie(response: Response, token: str, expira: datetime, recordarme: bool) -> None:
    # Sin "Recordarme" la cookie se borra al cerrar el navegador
    max_age = int((expira - datetime.now(timezone.utc)).total_seconds()) if recordarme else None
    response.set_cookie(
        NOMBRE_COOKIE,
        token,
        max_age=max_age,
        httponly=True,
        secure=COOKIE_SEGURA,
        samesite="lax",
        path="/",
    )


def borrar_cookie(response: Response) -> None:
    response.delete_cookie(NOMBRE_COOKIE, path="/")


# Estos dos hacen que aparezcan en el botón Authorize de /docs
esquema_cookie = APIKeyCookie(name=NOMBRE_COOKIE, auto_error=False)
esquema_csrf = APIKeyHeader(name="X-CSRF-Token", auto_error=False)


def funcionario_actual(
    request: Request,
    token: str | None = Depends(esquema_cookie),
    csrf: str | None = Depends(esquema_csrf),
    db: Session = Depends(get_db),
) -> dict:
    """
    Se pone en todas las rutas del funcionario.
    Revisa la cookie de sesión y, si la petición modifica datos, el token CSRF.
    """
    if not token:
        raise ErrorApi(401, "Debes iniciar sesión.", "sin_sesion")

    fila = db.execute(
        text(
            """
            SELECT f.id, f.usuario, f.activo,
                   concat_ws(' ', f.nombre1, f.nombre2, f.apellido_1, f.apellido_2) AS nombre_completo,
                   s.id AS sesion_id, s.csrf_token, s.expira_en
            FROM sesion s
            JOIN funcionario f ON f.id = s.funcionario_id
            WHERE s.token_hash = :hash
              AND NOT s.revocada
              AND s.expira_en > now()
              AND f.activo
            """
        ),
        {"hash": hash_token(token)},
    ).mappings().first()

    if not fila:
        raise ErrorApi(401, "Tu sesión venció. Inicia sesión de nuevo.", "sesion_vencida")

    if request.method not in METODOS_SEGUROS:
        if not csrf or not secrets.compare_digest(csrf, fila["csrf_token"]):
            raise ErrorApi(403, "Token de seguridad inválido. Recarga la página.", "csrf_invalido")

    return dict(fila)


def datos_publicos(funcionario: dict) -> dict:
    """Lo que el front puede ver del funcionario."""
    return {
        "id": funcionario["id"],
        "usuario": funcionario["usuario"],
        "nombre_completo": funcionario["nombre_completo"],
        "activo": funcionario["activo"],
    }