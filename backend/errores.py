"""
Errores de la API con un código estable que el front puede reconocer.
Respuesta: {"detail": "mensaje para el usuario", "code": "codigo_corto"}
"""
from fastapi import Request
from fastapi.responses import JSONResponse


class ErrorApi(Exception):
    def __init__(self, status: int, detail: str, code: str | None = None):
        self.status = status
        self.detail = detail
        self.code = code


async def manejar_error_api(request: Request, exc: ErrorApi):
    return JSONResponse(
        status_code=exc.status,
        content={"detail": exc.detail, "code": exc.code},
    )