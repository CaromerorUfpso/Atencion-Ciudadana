import { useCallback, useEffect, useMemo, useState } from "react";
import { authService } from "../../../services/authService";
import { registrarSesionVencida, setCsrfToken } from "../../../services/api";

import { AuthContext } from "./authContextObject.js";

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true); // verificando sesión al cargar
  const [avisoSesion, setAvisoSesion] = useState("");

  // Al cargar/recargar: la cookie HttpOnly es la fuente de verdad.
  useEffect(() => {
    let activo = true;
    authService
      .me()
      .then((f) => activo && setUsuario(f))
      .catch(() => activo && setUsuario(null))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, []);

  // Si el servidor responde 401 en cualquier petición, la sesión venció.
  useEffect(
    () =>
      registrarSesionVencida(() => {
        setUsuario(null);
        setAvisoSesion("Tu sesión venció. Inicia sesión de nuevo.");
      }),
    []
  );

  const iniciarSesion = useCallback(async (datos) => {
    const f = await authService.login(datos);
    setAvisoSesion("");
    setUsuario(f);
    return f;
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // aunque falle la red, se limpia el estado local
    } finally {
      setCsrfToken(null);
      setUsuario(null);
      setAvisoSesion("");
    }
  }, []);

  const valor = useMemo(
    () => ({ usuario, cargando, avisoSesion, iniciarSesion, cerrarSesion }),
    [usuario, cargando, avisoSesion, iniciarSesion, cerrarSesion]
  );
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
