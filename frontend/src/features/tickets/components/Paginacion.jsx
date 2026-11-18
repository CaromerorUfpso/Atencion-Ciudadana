import { ChevronLeft, ChevronRight } from "lucide-react";

function Paginacion({ pagina, paginas, total, tamano, onCambiar, deshabilitado }) {
  if (total === 0) return null;
  const desde = (pagina - 1) * tamano + 1;
  const hasta = Math.min(pagina * tamano, total);
  const boton =
    "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 text-xs text-slate-500 sm:flex-row">
      <span>
        Mostrando {desde}–{hasta} de {total}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className={boton} disabled={deshabilitado || pagina <= 1} onClick={() => onCambiar(pagina - 1)}>
          <ChevronLeft size={14} /> Anterior
        </button>
        <span className="font-medium text-slate-700">
          Página {pagina} de {paginas}
        </span>
        <button type="button" className={boton} disabled={deshabilitado || pagina >= paginas} onClick={() => onCambiar(pagina + 1)}>
          Siguiente <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default Paginacion;
