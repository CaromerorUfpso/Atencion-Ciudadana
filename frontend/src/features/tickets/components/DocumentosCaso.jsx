import { useState } from "react";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { documentService, mensajeDeDocumento } from "../../../services/documentService.js";
import { formatearFecha, formatearTamano } from "../utils/formato.js";

// Lista los PDF reales del caso (tabla documento_adjunto). Abrir/Descargar piden el archivo a
// FastAPI con la sesión; nunca se usa una URL pública ni se muestra la ruta del servidor.
function DocumentosCaso({ documentos }) {
  const [ocupado, setOcupado] = useState(null); // "ver-3" | "bajar-3"
  const [errores, setErrores] = useState({}); // { [idDocumento]: mensaje }

  const ejecutar = async (doc, accion) => {
    setOcupado(`${accion}-${doc.id}`);
    setErrores((e) => ({ ...e, [doc.id]: null }));
    try {
      if (accion === "ver") await documentService.abrir(doc.id);
      else await documentService.descargar(doc.id, doc.nombre_original);
    } catch (error) {
      setErrores((e) => ({ ...e, [doc.id]: mensajeDeDocumento(error) }));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
        <FileText size={15} className="text-slate-400" />
        Documentos adjuntos ({documentos.length})
      </h4>

      {documentos.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-[13px] text-slate-500">
          Este caso no tiene documentos adjuntos.
        </p>
      ) : (
        <ul className="space-y-2">
          {documentos.map((doc) => (
            <li key={doc.id} className="rounded-lg border border-slate-200 bg-white p-3 text-[13px]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{doc.tipo_etiqueta}</p>
                  <p className="truncate text-slate-600" title={doc.nombre_original}>
                    {doc.nombre_original}
                  </p>
                  <p className="text-xs text-slate-400">
                    Cargado: {formatearFecha(doc.subido_en)} · {formatearTamano(doc.tamano_bytes)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={!doc.disponible || ocupado !== null}
                    onClick={() => ejecutar(doc, "ver")}
                    className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
                  >
                    {ocupado === `ver-${doc.id}` ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
                    Abrir
                  </button>
                  <button
                    type="button"
                    disabled={!doc.disponible || ocupado !== null}
                    onClick={() => ejecutar(doc, "bajar")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    {ocupado === `bajar-${doc.id}` ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                    Descargar
                  </button>
                </div>
              </div>

              {!doc.disponible && (
                <p role="alert" className="mt-2 text-rose-600">
                  El archivo no está disponible en el servidor.
                </p>
              )}
              {errores[doc.id] && (
                <p role="alert" className="mt-2 text-rose-600">
                  {errores[doc.id]}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default DocumentosCaso;
