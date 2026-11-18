import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { mensajeDeError } from "../services/api.js";
import { profileService } from "../services/profileService.js";
import { formatearFecha } from "../features/tickets/utils/formato.js";
import { obtenerIniciales } from "../components/layout/iniciales.js";

function Campo({ etiqueta, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{etiqueta}</p>
      <p className="mt-0.5 break-words text-sm text-slate-900">{children || "—"}</p>
    </div>
  );
}

// Datos reales del funcionario autenticado (tabla `funcionario`). La base no guarda correo,
// cargo ni rol, por eso no se muestran. Solo lectura.
function Perfil() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    profileService.obtener().then(setDatos).catch((e) => setError(mensajeDeError(e, "No se pudo cargar el perfil.")));
  }, []);

  if (error) return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;
  if (!datos) return <div className="flex h-72 items-center justify-center"><Loader2 size={32} className="animate-spin text-brand-600" /></div>;

  const f = datos.funcionario;
  const a = datos.actividad;
  return (
    <div className="max-w-3xl space-y-4 pb-12">
      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xl font-semibold tracking-wide text-white">{obtenerIniciales(f.nombre_completo)}</div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{f.nombre_completo}</h2>
          <p className="text-sm text-slate-500">@{f.usuario} · {f.activo ? "Cuenta activa" : "Cuenta inactiva"}</p>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-x-6 gap-y-5 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2">
        <Campo etiqueta="Nombre completo">{f.nombre_completo}</Campo>
        <Campo etiqueta="Usuario">{f.usuario}</Campo>
        <Campo etiqueta="Estado de la cuenta">{f.activo ? "Activa" : "Inactiva"}</Campo>
        <Campo etiqueta="La sesión actual expira">{formatearFecha(datos.sesion_expira_en)}</Campo>
      </section>

      <section className="grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-200 bg-white p-6 text-center">
        <div><p className="text-2xl font-semibold tabular-nums text-slate-900">{a.casos_abiertos}</p><p className="mt-1 text-xs text-slate-500">Casos abiertos asignados</p></div>
        <div><p className="text-2xl font-semibold tabular-nums text-slate-900">{a.casos_cerrados}</p><p className="mt-1 text-xs text-slate-500">Casos resueltos</p></div>
        <div><p className="text-2xl font-semibold tabular-nums text-slate-900">{a.seguimientos_registrados}</p><p className="mt-1 text-xs text-slate-500">Seguimientos registrados</p></div>
      </section>
    </div>
  );
}

export default Perfil;
