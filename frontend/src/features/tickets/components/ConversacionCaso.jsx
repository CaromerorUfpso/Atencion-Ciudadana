import { MessageSquare, StickyNote } from "lucide-react";
import { ESTADOS_ENVIO, formatearFecha } from "../utils/formato.js";

// Historial de seguimiento real: tabla `seguimiento` (funcionario) + `respuesta_ciudadano`.
function ConversacionCaso({ chat }) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
        <MessageSquare size={15} className="text-slate-400" />
        Historial de seguimiento ({chat.length})
      </h4>

      {chat.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-[13px] text-slate-500">
          Aún no hay mensajes ni respuestas en este caso.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {chat.map((m) => {
            const esCiudadano = m.autor === "ciudadano";
            const interna = !esCiudadano && !m.enviar_ciudadano;
            const envio = ESTADOS_ENVIO[m.estado_envio];
            return (
              <li key={`${m.autor}-${m.id}`} className={`flex ${esCiudadano ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[85%] rounded-lg border p-3 text-[13px] ${
                    esCiudadano
                      ? "bg-slate-50 border-slate-200"
                      : interna
                        ? "bg-amber-50/60 border-amber-200"
                        : "bg-brand-50/70 border-brand-100"
                  }`}
                >
                  <p className="mb-1 flex items-center gap-1 font-medium text-slate-800">
                    {interna && <StickyNote size={12} className="text-amber-600" />}
                    {esCiudadano ? "Ciudadano" : m.funcionario || "Funcionario"}
                    {interna && <span className="font-normal text-amber-700"> · observación interna</span>}
                  </p>
                  <p className="whitespace-pre-line text-slate-700 leading-relaxed">{m.texto}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                    <span>{formatearFecha(m.fecha)}</span>
                    {!esCiudadano && !interna && envio && (
                      <span className={`font-medium ${envio.estilo}`}>{envio.etiqueta}</span>
                    )}
                  </p>
                  {m.estado_envio === "fallido" && m.error_envio && (
                    <p className="mt-1 break-words text-xs text-rose-600">{m.error_envio}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default ConversacionCaso;
