// Cliente HTTP único hacia FastAPI. React nunca habla con PostgreSQL.
//
// - La sesión viaja en una cookie HttpOnly (withCredentials). JavaScript no puede leerla.
// - El token CSRF se guarda SOLO en memoria (no en localStorage/sessionStorage) y se envía
//   en la cabecera X-CSRF-Token en las peticiones que modifican datos.
import axios from "axios";

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

let csrfToken = null;
export const setCsrfToken = (token) => {
  csrfToken = token || null;
};

// Rutas donde un 401 es normal y NO significa "sesión vencida".
const RUTAS_AUTH_SIN_AVISO = ["/api/auth/login", "/api/auth/me", "/api/auth/logout"];

let alSesionVencida = null;
export const registrarSesionVencida = (callback) => {
  alSesionVencida = callback;
  return () => {
    if (alSesionVencida === callback) alSesionVencida = null;
  };
};

const METODOS_SEGUROS = ["get", "head", "options"];

api.interceptors.request.use((config) => {
  const metodo = (config.method || "get").toLowerCase();
  if (!METODOS_SEGUROS.includes(metodo) && csrfToken) {
    config.headers["X-CSRF-Token"] = csrfToken;
  }
  return config;
});

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    const url = error.config?.url || "";
    if (error.response?.status === 401 && !RUTAS_AUTH_SIN_AVISO.some((r) => url.startsWith(r))) {
      setCsrfToken(null);
      alSesionVencida?.();
    }
    return Promise.reject(error);
  }
);

// Convierte cualquier error de Axios en un mensaje en español para mostrar al usuario.
export function mensajeDeError(error, porDefecto = "Ocurrió un error inesperado.") {
  if (!error?.response) {
    return error?.code === "ECONNABORTED"
      ? "El servidor tardó demasiado en responder."
      : "No se pudo conectar con el servidor. Verifica tu conexión.";
  }
  const { status, data } = error.response;
  if (status === 429) return data?.detail || "Demasiados intentos. Espera unos minutos.";
  if (status >= 500) return "El servidor tuvo un problema. Inténtalo más tarde.";
  return (typeof data?.detail === "string" && data.detail) || porDefecto;
}

// Código estable del error del servidor (p. ej. "caso_ya_asignado"), si lo hay.
export const codigoDeError = (error) => error?.response?.data?.code || null;
