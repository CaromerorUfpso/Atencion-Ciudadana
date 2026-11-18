import { BarChart3, CheckCircle, Clock, Loader2, TrendingUp } from "lucide-react";
import StatCard from "../components/ui/statCard.jsx";
import { useReportes } from "../features/tickets/hooks/useReportes.js";
import { CATEGORIAS, TIPOS, URGENCIAS } from "../features/tickets/utils/formato.js";

const pct = (n, total) => (total > 0 ? Math.round((n / total) * 100) : 0);

function Barra({ etiqueta, valor, total }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-3 text-[13px]">
        <span className="font-medium text-slate-700">{etiqueta}</span>
        <span className="tabular-nums text-slate-500">{valor} ({pct(valor, total)}%)</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100">
        <div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${pct(valor, total)}%` }} />
      </div>
    </div>
  );
}

// Estadísticas calculadas por PostgreSQL (GET /api/reportes). Sin cifras de ejemplo.
function Reportes() {
  const { datos, cargando, error, recargar } = useReportes();

  if (cargando && !datos) {
    return <div className="flex h-96 items-center justify-center text-slate-400"><Loader2 size={32} className="animate-spin text-brand-600" /></div>;
  }
  if (error && !datos) {
    return (
      <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error} <button type="button" onClick={recargar} className="ml-2 font-medium underline">Reintentar</button>
      </div>
    );
  }

  const t = datos.totales;
  return (
    <div className="space-y-8 pb-12 text-sm">
      <h2 className="text-base font-semibold text-slate-900">Reportes y estadísticas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Casos para funcionarios" value={t.total_casos} icon={BarChart3} description="Total en la base de datos" />
        <StatCard title="Tasa de resolución" value={`${pct(t.cerrados, t.total_casos)}%`} icon={TrendingUp} description={`${t.cerrados} de ${t.total_casos} resueltos`} />
        <StatCard title="Sin asignar" value={t.sin_asignar} icon={Clock} description="Casos abiertos sin responsable" />
        <StatCard title="Resueltos por la IA" value={t.resueltos_por_ia} icon={CheckCircle} description={`de ${t.total_mensajes} mensajes recibidos`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">Por tipo</h3>
          {datos.por_tipo.map((x) => <Barra key={x.tipo} etiqueta={TIPOS[x.tipo]?.etiqueta ?? x.tipo} valor={x.total} total={t.total_casos} />)}
        </section>
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">Por categoría</h3>
          {datos.por_categoria.map((x) => <Barra key={x.categoria} etiqueta={CATEGORIAS[x.categoria] ?? x.categoria} valor={x.total} total={t.total_casos} />)}
        </section>
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">Abiertos por urgencia</h3>
          {datos.abiertos_por_urgencia.length === 0 && <p className="text-xs text-slate-500">No hay casos abiertos.</p>}
          {datos.abiertos_por_urgencia.map((x) => <Barra key={x.urgencia} etiqueta={URGENCIAS[x.urgencia]?.etiqueta ?? x.urgencia} valor={x.total} total={t.pendientes + t.en_tramite} />)}
        </section>
      </div>
    </div>
  );
}

export default Reportes;
