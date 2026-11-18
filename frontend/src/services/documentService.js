// PDF de los casos. Son privados: se piden a FastAPI con la sesión y se muestran desde un Blob
// en memoria (no existe una URL pública ni se conocen rutas del servidor).
import { api } from "./api";

// Con responseType "blob" el cuerpo de un error también llega como Blob: se vuelve a leer como JSON
// para conservar el mensaje y el `code` del servidor.
async function normalizarError(error) {
  const datos = error?.response?.data;
  if (datos instanceof Blob) {
    try {
      error.response.data = JSON.parse(await datos.text());
    } catch {
      error.response.data = {};
    }
  }
  return error;
}

async function pedir(adjuntoId, modo) {
  try {
    const r = await api.get(`/api/adjuntos/${adjuntoId}`, { params: { modo }, responseType: "blob" });
    return r.data;
  } catch (e) {
    throw await normalizarError(e);
  }
}

export const documentService = {
  async listar(casoId) {
    return (await api.get(`/api/casos/${casoId}/documentos`)).data;
  },
  // Abre el PDF en otra pestaña. La pestaña se abre ANTES de la petición (dentro del clic) para
  // que el navegador no la bloquee como ventana emergente.
  async abrir(adjuntoId) {
    const ventana = window.open("about:blank", "_blank");
    if (!ventana) throw new Error("El navegador bloqueó la ventana. Permite las ventanas emergentes e inténtalo de nuevo.");
    try {
      ventana.opener = null;
      const blob = await pedir(adjuntoId, "ver");
      const url = URL.createObjectURL(blob);
      ventana.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    } catch (e) {
      ventana.close();
      throw e;
    }
  },
  async descargar(adjuntoId, nombre = `documento_${adjuntoId}.pdf`) {
    const blob = await pedir(adjuntoId, "descargar");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  },
};

// Mensaje claro según el `code` que devuelve el servidor.
export function mensajeDeDocumento(error) {
  const code = error?.response?.data?.code;
  if (code === "archivo_no_disponible") return "El archivo no está disponible en el servidor.";
  if (code === "archivo_invalido") return "El archivo está dañado o no es un PDF válido.";
  if (code === "documento_no_encontrado") return "El documento ya no existe.";
  if (error?.response?.status === 401) return "Tu sesión venció. Inicia sesión de nuevo.";
  return error?.response ? "No se pudo obtener el documento." : error?.message || "No se pudo obtener el documento.";
}
