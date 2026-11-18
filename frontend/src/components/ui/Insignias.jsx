import { ESTADOS, TIPOS, URGENCIAS } from "../../features/tickets/utils/formato.js";

export function EstadoBadge({ estado }) {
  const e = ESTADOS[estado];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${
        e?.estilo ?? "bg-slate-100 text-slate-700 border border-slate-200"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
      {e?.etiqueta ?? estado}
    </span>
  );
}

export function TipoBadge({ tipo }) {
  const t = TIPOS[tipo];
  return (
    <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${t?.estilo ?? ""}`}>
      {t?.etiqueta ?? tipo}
    </span>
  );
}

export function UrgenciaBadge({ urgencia }) {
  const u = URGENCIAS[urgencia];
  return (
    <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${u?.estilo ?? ""}`}>
      {u?.etiqueta ?? urgencia}
    </span>
  );
}
