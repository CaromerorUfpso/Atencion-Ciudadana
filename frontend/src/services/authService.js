import { api, setCsrfToken } from "./api";

function guardarSesion({ data }) {
  setCsrfToken(data.csrf_token);
  return data.funcionario;
}

export const authService = {
  // Devuelve el funcionario. La cookie la coloca el servidor (HttpOnly).
  async login({ usuario, password, recordarme }) {
    return guardarSesion(await api.post("/api/auth/login", { usuario, password, recordarme }));
  },
  // Verifica la sesión (al cargar/recargar la página).
  async me() {
    return guardarSesion(await api.get("/api/auth/me"));
  },
  async logout() {
    try {
      await api.post("/api/auth/logout");
    } finally {
      setCsrfToken(null);
    }
  },
};
