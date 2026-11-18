import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Eye, HelpCircle, Loader2, MessageSquareWarning, RefreshCw, Search } from "lucide-react";
import { mensajeDeError } from "../../../services/api.js";
import { complaintService } from "../../../services/complaintService.js";
import { EstadoBadge, TipoBadge, UrgenciaBadge } from "../../../components/ui/Insignias.jsx";
import CasoDetalleModal from "../components/CasoDetalleModal.jsx";
import Paginacion from "../components/Paginacion.jsx";
import { useDebounce } from "../hooks/useDebounce.js";
import { CATEGORIAS, ESTADOS, URGENCIAS, formatearFecha } from "../utils/formato.js";

const TAMANO_PAGINA = 15;
const selectCls =
  "h-9 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10";

const PESTANAS = [
  { valor: "", etiqueta: "Todos", icono: null },
  { valor: "queja", etiqueta: "Quejas", icono: <AlertCircle size={13} className="text-blue-600" /> },
  { valor: "reclamo", etiqueta: "Reclamos", icono: <MessageSquareWarning size={13} className="text-orange-600" /> },
  { valor: "duda", etiqueta: "Dudas", icono: <HelpCircle size={13} className="text-green-600" /> },
];

// Bandeja de solicitudes: TODO (búsqueda, filtros, orden y paginación) se resuelve en PostgreSQL
// a través de GET /api/casos; el navegador solo muestra la página pedida.
function Quejas() {
  const [filtros, setFiltros] = useState({
    estado: "abiertos",
    tipo: "",
    categoria: "",
    urgencia: "",
    asignacion: "todos",
  });
  const [busqueda, setBusqueda] = useState("");
  const q = useDebounce(busqueda.trim(), 350);
  const [pagina, setPagina] = useState(1);

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [seleccionada, setSeleccionada] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const controlador = useRef(null);

  useEffect(() => {
    controlador.current?.abort(); // una respuesta vieja no pisa a una más reciente
    const ctl = new AbortController();
    controlador.current = ctl;
    setCargando(true);
    complaintService
      .listar({ ...filtros, q, page: pagina, page_size: TAMANO_PAGINA }, { signal: ctl.signal })
      .then((d) => {
        setDatos(d);
        setError("");
        if (d.page !== pagina) setPagina(d.page);
      })
      .catch((e) => {
        if (e?.code === "ERR_CANCELED") return;
        setError(mensajeDeError(e, "No se pudieron cargar las solicitudes."));
      })
      .finally(() => {
        if (!ctl.signal.aborted) setCargando(false);
      });
    return () => ctl.abort();
  }, [filtros, q, pagina, recarga]);

  const cambiarFiltro = (campo) => (e) => {
    setFiltros((f) => ({ ...f, [campo]: e.target.value }));
    setPagina(1);
  };
  const refrescar = useCallback(() => setRecarga((n) => n + 1), []);

  const items = datos?.items ?? [];
  const conteo = datos?.conteo_por_tipo ?? {};
  const totalTodos = Object.values(conteo).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 pb-12 text-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Bandeja de solicitudes</h2>
        <button
          type="button"
          onClick={refrescar}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <RefreshCw size={12} className={`text-blue-600 ${cargando ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {/* Pestañas por tipo + búsqueda */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {PESTANAS.map((p) => (
            <button
              key={p.valor || "todos"}
              type="button"
              onClick={() => {
                setFiltros((f) => ({ ...f, tipo: p.valor }));
                setPagina(1);
              }}
              className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] font-medium transition ${
                filtros.tipo === p.valor
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {p.icono}
              {p.etiqueta}
              {datos && ` (${p.valor ? (conteo[p.valor] ?? 0) : totalTodos})`}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Buscar solicitudes"
            placeholder="Buscar por nombre, documento, # o texto…"
            value={busqueda}
            maxLength={100}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10"
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="Filtrar por estado" value={filtros.estado} onChange={cambiarFiltro("estado")} className={selectCls}>
          <option value="abiertos">Estado: Abiertos</option>
          <option value="recibido">{ESTADOS.recibido.etiqueta}</option>
          <option value="en_tramite">{ESTADOS.en_tramite.etiqueta}</option>
          <option value="cerrado">{ESTADOS.cerrado.etiqueta}</option>
          <option value="todos">Todos los estados</option>
        </select>
        <select aria-label="Filtrar por categoría" value={filtros.categoria} onChange={cambiarFiltro("categoria")} className={selectCls}>
          <option value="">Categoría: Todas</option>
          {Object.entries(CATEGORIAS).map(([v, e]) => (
            <option key={v} value={v}>{e}</option>
          ))}
        </select>
        <select aria-label="Filtrar por urgencia" value={filtros.urgencia} onChange={cambiarFiltro("urgencia")} className={selectCls}>
          <option value="">Urgencia: Todas</option>
          {Object.entries(URGENCIAS).map(([v, { etiqueta }]) => (
            <option key={v} value={v}>{etiqueta}</option>
          ))}
        </select>
        <select aria-label="Filtrar por asignación" value={filtros.asignacion} onChange={cambiarFiltro("asignacion")} className={selectCls}>
          <option value="todos">Asignación: Todas</option>
          <option value="mios">Mis casos</option>
          <option value="sin_asignar">Sin asignar</option>
        </select>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={refrescar} className="font-medium underline">Reintentar</button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Urgencia</th>
                <th className="px-4 py-3">Ciudadano</th>
                <th className="px-4 py-3">Recibido</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Funcionario</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {cargando && !datos ? (
                <tr>
                  <td colSpan="9" className="px-6 py-16 text-center text-slate-500">
                    <Loader2 size={26} className="mx-auto mb-2 animate-spin text-brand-600" />
                    Cargando solicitudes…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-slate-500">
                    {error
                      ? "No se pudo cargar la información."
                      : "No se encontraron solicitudes con los filtros seleccionados."}
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.id} className={`transition-colors hover:bg-slate-50/70 ${cargando ? "opacity-60" : ""}`}>
                    <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-slate-900">
                      #{c.id}
                      {c.respuesta_pendiente && (
                        <span
                          title="El ciudadano escribió y espera respuesta"
                          className="ml-1.5 inline-block h-2 w-2 rounded-full bg-rose-500 align-middle"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3.5"><TipoBadge tipo={c.tipo} /></td>
                    <td className="px-4 py-3.5 text-slate-700">{CATEGORIAS[c.categoria] || c.categoria}</td>
                    <td className="px-4 py-3.5"><UrgenciaBadge urgencia={c.urgencia} /></td>
                    <td className="px-4 py-3.5 text-slate-700">{c.ciudadano || "Sin nombre"}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-slate-500">{formatearFecha(c.creado_en)}</td>
                    <td className="px-4 py-3.5"><EstadoBadge estado={c.estado_tramite} /></td>
                    <td className="px-4 py-3.5 text-slate-700">{c.funcionario || "Sin asignar"}</td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSeleccionada(c.id)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <Eye size={14} className="text-blue-600" />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {datos && (
          <Paginacion
            pagina={datos.page}
            paginas={datos.pages}
            total={datos.total}
            tamano={datos.page_size}
            deshabilitado={cargando}
            onCambiar={setPagina}
          />
        )}
      </div>

      {seleccionada && (
        <CasoDetalleModal casoId={seleccionada} onCerrar={() => setSeleccionada(null)} onCambio={refrescar} />
      )}
    </div>
  );
}

export default Quejas;
