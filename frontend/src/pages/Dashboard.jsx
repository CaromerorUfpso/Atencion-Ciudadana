import { useState } from "react";
import { CheckCircle, Clock, FileText, Loader, Loader2 } from "lucide-react";
import StatCard from "../components/ui/statCard.jsx";
import ComplaintTable from "../features/tickets/components/complaintTable.jsx";
import CasoDetalleModal from "../features/tickets/components/CasoDetalleModal.jsx";
import { useReportes } from "../features/tickets/hooks/useReportes.js";

// Todas las cifras salen de PostgreSQL (GET /api/reportes). Si falla, se muestra el error:
// nunca se rellenan con valores de ejemplo.
function Dashboard() {
  const { datos, cargando, error, recargar } = useReportes();
  const [seleccionada, setSeleccionada] = useState(null);

  if (cargando && !datos) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-slate-500">
        <Loader2 size={32} className="mb-3 animate-spin text-brand-600" />
        <p className="text-sm font-medium">Cargando estadísticas...</p>
      </div>
    );
  }

  if (error && !datos) {
    return (
      <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        <p>{error}</p>
        <button type="button" onClick={recargar} className="mt-2 font-medium underline">
          Reintentar
        </button>
      </div>
    );
  }

  const t = datos.totales;
  const quejas = datos.por_tipo.find((x) => x.tipo === "queja")?.total ?? 0;
  const reclamos = datos.por_tipo.find((x) => x.tipo === "reclamo")?.total ?? 0;
  const dudas = datos.por_tipo.find((x) => x.tipo === "duda")?.total ?? 0;

  return (
    <div className="space-y-8 pb-12 text-sm">
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Resumen general del sistema</h2>

        {error && (
          <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            No se pudo actualizar: {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total de quejas"
            value={t.total_casos}
            icon={FileText}
            description={`${quejas} quejas, ${reclamos} reclamos y ${dudas} dudas`}
          />
          <StatCard title="Pendientes" value={t.pendientes} icon={Clock} description="Aún sin iniciar trámite" />
          <StatCard title="En proceso" value={t.en_tramite} icon={Loader} description="Con trámite en curso" />
          <StatCard
            title="Resueltas"
            value={t.cerrados}
            icon={CheckCircle}
            description={`${t.cerrados_este_mes} cerradas este mes`}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Casos recientes</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <ComplaintTable casos={datos.recientes} onVer={setSeleccionada} />
        </div>
      </div>

      {seleccionada && (
        <CasoDetalleModal casoId={seleccionada} onCerrar={() => setSeleccionada(null)} onCambio={recargar} />
      )}
    </div>
  );
}

export default Dashboard;
