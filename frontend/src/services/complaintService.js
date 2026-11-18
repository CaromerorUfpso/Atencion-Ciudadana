// Casos reales (FastAPI /api/casos, /api/reportes). Todas las llamadas llevan la cookie de sesión
// y, si modifican datos, el token CSRF (lo agrega api.js).
import { api } from "./api";

export const complaintService = {
  // Lista paginada y filtrada en el servidor:
  // { estado, tipo, categoria, urgencia, asignacion, q, orden, page, page_size }
  // -> { items, total, page, page_size, pages, conteo_por_tipo }
  async listar(params = {}, opciones = {}) {
    const limpios = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== "" && v != null)
    );
    return (await api.get("/api/casos", { params: limpios, signal: opciones.signal })).data;
  },
  // -> { caso, adjuntos, chat }
  async obtener(id) {
    return (await api.get(`/api/casos/${id}`)).data;
  },
  async tomar(id) {
    return (await api.post(`/api/casos/${id}/tomar`)).data;
  },
  async liberar(id) {
    return (await api.post(`/api/casos/${id}/liberar`)).data;
  },
  // enviar_ciudadano=true => WhatsApp (lo envía el backend); false => observación interna
  async agregarSeguimiento(id, { texto, enviar_ciudadano = true }) {
    return (await api.post(`/api/casos/${id}/seguimiento`, { texto, enviar_ciudadano })).data;
  },
  // estado: "recibido" | "en_tramite" | "cerrado"
  async cambiarEstado(id, { estado, mensaje = null, notificar_ciudadano = true }) {
    return (await api.patch(`/api/casos/${id}/estado`, { estado, mensaje, notificar_ciudadano })).data;
  },
  async reportes() {
    return (await api.get("/api/reportes")).data;
  },
};
