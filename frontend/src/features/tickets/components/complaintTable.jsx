import { EstadoBadge, TipoBadge, UrgenciaBadge } from "../../../components/ui/Insignias.jsx";
import { formatearFecha } from "../utils/formato.js";

// Casos recientes (los 5 últimos recibidos). Los datos llegan por props desde /api/reportes.
function ComplaintTable({ casos = [], onVer }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
            <th className="px-5 py-3">ID</th>
            <th className="px-5 py-3">Tipo</th>
            <th className="px-5 py-3">Urgencia</th>
            <th className="px-5 py-3">Ciudadano</th>
            <th className="px-5 py-3">Recibido</th>
            <th className="px-5 py-3">Estado</th>
            {onVer && <th className="px-5 py-3 text-right">Acción</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-[13px]">
          {casos.length > 0 ? (
            casos.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-slate-50/70">
                <td className="px-5 py-3.5 font-semibold text-slate-900">#{c.id}</td>
                <td className="px-5 py-3.5"><TipoBadge tipo={c.tipo} /></td>
                <td className="px-5 py-3.5"><UrgenciaBadge urgencia={c.urgencia} /></td>
                <td className="px-5 py-3.5 text-slate-700">{c.ciudadano || "Sin nombre"}</td>
                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatearFecha(c.creado_en)}</td>
                <td className="px-5 py-3.5"><EstadoBadge estado={c.estado_tramite} /></td>
                {onVer && (
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => onVer(c.id)}
                      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Ver
                    </button>
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={onVer ? 7 : 6} className="px-6 py-12 text-center text-slate-500">
                No hay registros recientes para mostrar.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default ComplaintTable;
