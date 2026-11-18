import { useEffect, useState } from "react";
import { Eye, Loader2, Search } from "lucide-react";
import { mensajeDeError } from "../services/api.js";
import { complaintService } from "../services/complaintService.js";
import { EstadoBadge, TipoBadge } from "../components/ui/Insignias.jsx";
import CasoDetalleModal from "../features/tickets/components/CasoDetalleModal.jsx";
import Paginacion from "../features/tickets/components/Paginacion.jsx";
import { useDebounce } from "../features/tickets/hooks/useDebounce.js";
import { formatearFecha } from "../features/tickets/utils/formato.js";

// Solicitudes RESUELTAS (por_revisar.estado_tramite = 'cerrado'), con su historial de seguimiento.
function Historial() {
  const [busqueda, setBusqueda] = useState("");
  const q = useDebounce(busqueda.trim());
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [seleccionada, setSeleccionada] = useState(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    const ctl = new AbortController();
    setCargando(true);
    complaintService
      .listar({ estado: "cerrados", orden: "resolucion", q, page: pagina, page_size: 15 }, { signal: ctl.signal })
      .then((d) => { setDatos(d); setError(""); })
      .catch((e) => { if (e?.code !== "ERR_CANCELED") setError(mensajeDeError(e, "No se pudo cargar el historial.")); })
      .finally(() => { if (!ctl.signal.aborted) setCargando(false); });
    return () => ctl.abort();
  }, [q, pagina, recarga]);

  const items = datos?.items ?? [];
  return (
    <div className="space-y-6 pb-12 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-slate-900">Historial de solicitudes resueltas</h2>
        <div className="relative w-full md:w-80">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search" aria-label="Buscar en el historial" placeholder="Buscar por nombre, documento o #…"
            value={busqueda} maxLength={100}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-700">
          <span>{error}</span>
          <button type="button" className="font-medium underline" onClick={() => setRecarga((n) => n + 1)}>Reintentar</button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="px-5 py-3">Solicitud</th>
                <th className="px-5 py-3">Recibida</th>
                <th className="px-5 py-3">Resuelta</th>
                <th className="px-5 py-3">Funcionario responsable</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Seguimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {cargando && !datos ? (
                <tr><td colSpan="6" className="px-6 py-16 text-center text-slate-500"><Loader2 size={26} className="mx-auto mb-2 animate-spin text-brand-600" />Cargando historial…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-500">No hay solicitudes resueltas{q ? " que coincidan con la búsqueda" : ""}.</td></tr>
              ) : items.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-slate-50/70">
                  <td className="px-5 py-3.5">
                    <span className="font-semibold text-slate-900">#{c.id}</span>{" "}
                    <TipoBadge tipo={c.tipo} />
                    <p className="mt-1 line-clamp-1 text-slate-500">{c.ciudadano || "Sin nombre"} · {c.resumen}</p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatearFecha(c.creado_en)}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatearFecha(c.fecha_resuelto)}</td>
                  <td className="px-5 py-3.5 text-slate-700">{c.funcionario || "Sin asignar"}</td>
                  <td className="px-5 py-3.5"><EstadoBadge estado={c.estado_tramite} /></td>
                  <td className="px-5 py-3.5 text-right">
                    <button type="button" onClick={() => setSeleccionada(c.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                      <Eye size={14} /> Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {datos && <Paginacion pagina={datos.page} paginas={datos.pages} total={datos.total} tamano={datos.page_size} deshabilitado={cargando} onCambiar={setPagina} />}
      </div>

      {seleccionada && (
        <CasoDetalleModal casoId={seleccionada} onCerrar={() => setSeleccionada(null)} onCambio={() => setRecarga((n) => n + 1)} />
      )}
    </div>
  );
}

export default Historial;
