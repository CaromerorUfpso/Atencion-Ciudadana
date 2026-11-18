import { useCallback, useEffect, useState } from "react";
import { Loader2, X, RefreshCw } from "lucide-react";
import { mensajeDeError } from "../../../services/api.js";
import { complaintService } from "../../../services/complaintService.js";
import { EstadoBadge, TipoBadge, UrgenciaBadge } from "../../../components/ui/Insignias.jsx";
import { CATEGORIAS, TIPOS_IDENTIFICACION, formatearFecha } from "../utils/formato.js";
import AccionesCaso from "./AccionesCaso.jsx";
import ConversacionCaso from "./ConversacionCaso.jsx";
import DocumentosCaso from "./DocumentosCaso.jsx";

function Dato({ etiqueta, children }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500">{etiqueta}</p>
      <p className="mt-0.5 break-words text-slate-800">{children || "—"}</p>
    </div>
  );
}

// Detalle de UNA solicitud, consultado a FastAPI por id (nada estático).
// soloLectura: se usa en Historial (casos resueltos) para ocultar las acciones.
function CasoDetalleModal({ casoId, soloLectura = false, onCerrar, onCambio }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    try {
      const d = await complaintService.obtener(casoId);
      setDatos(d);
      setError("");
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo cargar la solicitud."));
      throw e;
    } finally {
      setCargando(false);
    }
  }, [casoId]);

  useEffect(() => {
    setCargando(true);
    setDatos(null);
    cargar().catch(() => {});
  }, [cargar]);

  const alCambiar = async () => {
    await cargar();
    onCambio?.(); // refresca la lista que está detrás
  };

  const caso = datos?.caso;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de la solicitud ${casoId}`}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h3 className="text-base font-semibold text-slate-900">Solicitud #{casoId}</h3>
            {caso && (
              <>
                <TipoBadge tipo={caso.tipo} />
                <UrgenciaBadge urgencia={caso.urgencia} />
                <EstadoBadge estado={caso.estado_tramite} />
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto p-6 text-sm">
          {cargando && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Loader2 size={28} className="mb-2 animate-spin text-brand-600" />
              <p className="text-xs font-medium">Cargando solicitud…</p>
            </div>
          )}

          {!cargando && error && !datos && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => {
                  setCargando(true);
                  cargar().catch(() => {});
                }}
                className="mt-2 inline-flex items-center gap-1.5 font-medium underline"
              >
                <RefreshCw size={12} /> Reintentar
              </button>
            </div>
          )}

          {caso && (
            <>
              <section className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-[13px] sm:grid-cols-2">
                <Dato etiqueta="Ciudadano">{caso.ciudadano}</Dato>
                <Dato etiqueta="Identificación">
                  {caso.numero_documento
                    ? `${TIPOS_IDENTIFICACION[caso.tipo_identificacion] || caso.tipo_identificacion || ""} ${caso.numero_documento}`.trim()
                    : null}
                </Dato>
                <Dato etiqueta="Teléfono">{caso.telefono}</Dato>
                <Dato etiqueta="Categoría">{CATEGORIAS[caso.categoria] || caso.categoria}</Dato>
                <Dato etiqueta="Fecha de recepción">{formatearFecha(caso.creado_en)}</Dato>
                <Dato etiqueta="Fecha de resolución">
                  {caso.fecha_resuelto ? formatearFecha(caso.fecha_resuelto) : null}
                </Dato>
                <Dato etiqueta="Funcionario asignado">{caso.funcionario || "Sin asignar"}</Dato>
                <Dato etiqueta="Estado del trámite">
                  <EstadoBadge estado={caso.estado_tramite} />
                </Dato>
              </section>

              <section>
                <h4 className="mb-2 text-sm font-semibold text-slate-900">Resumen</h4>
                <div className="whitespace-pre-line rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-sm leading-relaxed text-slate-700">
                  {caso.resumen}
                </div>
              </section>

              <section>
                <h4 className="mb-2 text-sm font-semibold text-slate-900">
                  Mensaje original recibido por WhatsApp
                </h4>
                <div className="whitespace-pre-line rounded-lg border border-brand-100 bg-brand-50/60 p-4 text-sm leading-relaxed text-slate-700">
                  {caso.texto_original || "Sin texto original registrado."}
                </div>
              </section>

              <DocumentosCaso documentos={datos.adjuntos} />
              <ConversacionCaso chat={datos.chat} />

              {!soloLectura && <AccionesCaso caso={caso} onCambio={alCambiar} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CasoDetalleModal;
