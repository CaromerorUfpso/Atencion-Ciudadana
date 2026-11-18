import { useCallback, useEffect, useState } from "react";
import { mensajeDeError } from "../../../services/api.js";
import { complaintService } from "../../../services/complaintService.js";

// Estadísticas reales (GET /api/reportes) para Dashboard y Reportes.
export function useReportes() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    complaintService
      .reportes()
      .then((d) => {
        if (!activo) return;
        setDatos(d);
        setError("");
      })
      .catch((e) => activo && setError(mensajeDeError(e, "No se pudieron cargar las estadísticas.")))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [recarga]);

  const recargar = useCallback(() => setRecarga((n) => n + 1), []);
  return { datos, cargando, error, recargar };
}
