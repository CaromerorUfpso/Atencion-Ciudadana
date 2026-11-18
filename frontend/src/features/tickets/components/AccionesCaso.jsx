import { useState } from "react";
import { CheckCircle, Loader2, RotateCcw, Send, UserCheck, UserMinus } from "lucide-react";
import { codigoDeError, mensajeDeError } from "../../../services/api.js";
import { complaintService } from "../../../services/complaintService.js";
import { ESTADOS } from "../utils/formato.js";

const MAX = 900;

// Acciones del funcionario sobre un caso: tomar/liberar, cambiar estado y responder.
// El servidor decide si están permitidas (403/409); aquí solo se muestran u ocultan botones.
function AccionesCaso({ caso, onCambio }) {
  const [texto, setTexto] = useState("");
  const [porWhatsapp, setPorWhatsapp] = useState(true);
  const [estadoNuevo, setEstadoNuevo] = useState("");
  const [mensajeEstado, setMensajeEstado] = useState("");
  const [notificarEstado, setNotificarEstado] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: "ok" | "error", texto }

  const cerrado = caso.estado_tramite === "cerrado";
  const asignadoAOtro = caso.funcionario_id != null && !caso.es_mio;

  const ejecutar = async (accion, mensajeOk) => {
    setOcupado(true);
    setAviso(null);
    try {
      const r = await accion();
      await onCambio().catch(() => {}); // la acción ya se hizo; si falla la recarga no es un error de la acción
      return { ok: true, respuesta: r, mensajeOk };
    } catch (error) {
      // 409/403: otro funcionario actuó antes -> se recarga para mostrar el estado real
      if (["caso_ya_asignado", "caso_de_otro_funcionario", "caso_cerrado", "sin_cambios"].includes(codigoDeError(error))) {
        await onCambio().catch(() => {});
      }
      setAviso({ tipo: "error", texto: mensajeDeError(error, "No se pudo completar la acción.") });
      return { ok: false };
    } finally {
      setOcupado(false);
    }
  };

  const tomar = async () => {
    const r = await ejecutar(() => complaintService.tomar(caso.id));
    if (r.ok) setAviso({ tipo: "ok", texto: "Caso asignado a ti." });
  };

  const liberar = async () => {
    const r = await ejecutar(() => complaintService.liberar(caso.id));
    if (r.ok) setAviso({ tipo: "ok", texto: "Caso devuelto a la bandeja." });
  };

  const aplicarEstado = async () => {
    if (!estadoNuevo) return;
    const r = await ejecutar(() =>
      complaintService.cambiarEstado(caso.id, {
        estado: estadoNuevo,
        mensaje: mensajeEstado.trim() || null,
        notificar_ciudadano: notificarEstado,
      })
    );
    if (!r.ok) return;
    setEstadoNuevo("");
    setMensajeEstado("");
    const aviso = r.respuesta?.aviso;
    if (aviso?.estado_envio === "fallido") {
      setAviso({ tipo: "error", texto: `Estado actualizado, pero el mensaje a WhatsApp falló: ${aviso.error}` });
    } else {
      setAviso({ tipo: "ok", texto: `Estado actualizado a "${ESTADOS[r.respuesta.estado]?.etiqueta}".` });
    }
  };

  const enviar = async (e) => {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;
    const r = await ejecutar(() =>
      complaintService.agregarSeguimiento(caso.id, { texto: limpio, enviar_ciudadano: porWhatsapp })
    );
    if (!r.ok) return;
    setTexto("");
    const { estado_envio, error } = r.respuesta;
    if (!porWhatsapp) setAviso({ tipo: "ok", texto: "Observación interna guardada." });
    else if (estado_envio === "enviado") setAviso({ tipo: "ok", texto: "Respuesta enviada al ciudadano por WhatsApp." });
    else setAviso({ tipo: "error", texto: `La respuesta quedó registrada pero NO se envió por WhatsApp: ${error || "error desconocido"}` });
  };

  const opcionesEstado = Object.entries(ESTADOS).filter(([valor]) => valor !== caso.estado_tramite);

  return (
    <div className="space-y-4 border-t border-slate-200 pt-5">
      {aviso && (
        <div
          role={aviso.tipo === "error" ? "alert" : "status"}
          className={`rounded-lg border px-3 py-2.5 text-[13px] font-medium ${
            aviso.tipo === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {aviso.texto}
        </div>
      )}

      {/* ASIGNACIÓN */}
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <span className="font-semibold text-slate-900">Funcionario asignado:</span>
        <span className="text-slate-600">{caso.funcionario || "Sin asignar"}</span>
        {!cerrado && caso.funcionario_id == null && (
          <button
            type="button"
            onClick={tomar}
            disabled={ocupado}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            <UserCheck size={14} /> Tomar caso
          </button>
        )}
        {!cerrado && caso.es_mio && (
          <button
            type="button"
            onClick={liberar}
            disabled={ocupado}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <UserMinus size={14} /> Liberar caso
          </button>
        )}
      </div>

      {asignadoAOtro && !cerrado && (
        <p className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-[13px] text-slate-600">
          Este caso está asignado a {caso.funcionario}. Puedes consultarlo, pero solo esa persona puede
          responderlo o cambiar su estado.
        </p>
      )}

      {/* CAMBIO DE ESTADO */}
      {(caso.puede_modificar || (cerrado && !asignadoAOtro)) && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-slate-600">Cambiar estado:</span>
            <select
              value={estadoNuevo}
              onChange={(e) => setEstadoNuevo(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10"
            >
              <option value="">Seleccionar…</option>
              {opcionesEstado.map(([valor, { etiqueta }]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={aplicarEstado}
              disabled={!estadoNuevo || ocupado}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {cerrado ? <RotateCcw size={13} /> : <CheckCircle size={13} />}
              {estadoNuevo === "cerrado" ? "Marcar como resuelta" : cerrado ? "Reabrir" : "Aplicar"}
            </button>
          </div>

          {estadoNuevo && (
            <div className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <textarea
                rows={2}
                maxLength={MAX}
                value={mensajeEstado}
                onChange={(e) => setMensajeEstado(e.target.value)}
                placeholder={
                  estadoNuevo === "cerrado"
                    ? "Mensaje de cierre (opcional; si lo dejas vacío se envía el mensaje estándar)"
                    : "Observación (opcional)"
                }
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10"
              />
              <label className="flex items-center gap-2 text-[13px] text-slate-600">
                <input
                  type="checkbox"
                  checked={notificarEstado}
                  onChange={(e) => setNotificarEstado(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                />
                Avisar al ciudadano por WhatsApp (si no, el texto queda como observación interna)
              </label>
            </div>
          )}
        </div>
      )}

      {/* RESPUESTA POR WHATSAPP */}
      {caso.puede_modificar && (
        <form onSubmit={enviar} className="space-y-3">
          <label className="block text-sm font-semibold text-slate-900">
            Responder al ciudadano
          </label>
          <textarea
            rows={4}
            maxLength={MAX}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe la respuesta o una observación…"
            className="w-full rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-[13px] text-slate-600">
              <input type="checkbox" checked={porWhatsapp} onChange={(e) => setPorWhatsapp(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
              Enviar por WhatsApp al ciudadano
            </label>
            <span className="text-xs tabular-nums text-slate-400">
              {texto.length}/{MAX}
            </span>
          </div>
          {porWhatsapp && !caso.ventana_whatsapp_abierta && (
            <p className="text-xs text-amber-700">
              Pasaron más de 24 h desde el último mensaje del ciudadano: WhatsApp exige enviar este
              aviso con la plantilla aprobada.
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={ocupado || !texto.trim()}
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-[13px] font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {ocupado ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {porWhatsapp ? "Enviar respuesta" : "Guardar observación"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default AccionesCaso;
