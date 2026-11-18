import { api } from "./api";

// Perfil real del funcionario autenticado (tabla `funcionario`) y su actividad.
// -> { funcionario, sesion_expira_en, actividad: { casos_abiertos, casos_cerrados, seguimientos_registrados } }
export const profileService = {
  async obtener() {
    return (await api.get("/api/perfil")).data;
  },
};
