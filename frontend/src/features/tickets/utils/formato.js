// Correspondencia entre los valores REALES de PostgreSQL (ENUM) y lo que ve el funcionario.
// La base no tiene otros estados: recibido / en_tramite / cerrado.
export const ESTADOS = {
  recibido: { etiqueta: "Pendiente", estilo: "bg-amber-50 text-amber-700 border border-amber-200" },
  en_tramite: { etiqueta: "En proceso", estilo: "bg-brand-50 text-brand-700 border border-brand-100" },
  cerrado: { etiqueta: "Resuelta", estilo: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
};

export const TIPOS = {
  queja: { etiqueta: "Queja", estilo: "bg-rose-50 text-rose-700 border border-rose-200" },
  reclamo: { etiqueta: "Reclamo", estilo: "bg-orange-50 text-orange-700 border border-orange-200" },
  duda: { etiqueta: "Duda", estilo: "bg-amber-50 text-amber-700 border border-amber-200" },
};

export const CATEGORIAS = {
  cita: "Cita",
  autorizacion: "Autorización",
  medicamento: "Medicamento",
  horario: "Horario",
  otro: "Otro",
};

export const URGENCIAS = {
  baja: { etiqueta: "Baja", estilo: "bg-slate-100 text-slate-700 border border-slate-200" },
  media: { etiqueta: "Media", estilo: "bg-sky-50 text-sky-700 border border-sky-200" },
  alta: { etiqueta: "Alta", estilo: "bg-orange-50 text-orange-700 border border-orange-200" },
  critica: { etiqueta: "Crítica", estilo: "bg-rose-50 text-rose-700 border border-rose-200" },
};

export const TIPOS_IDENTIFICACION = {
  CC: "Cédula de ciudadanía",
  TI: "Tarjeta de identidad",
  CE: "Cédula de extranjería",
  PPT: "PPT",
  PA: "Pasaporte",
  RC: "Registro civil",
};

export const ESTADOS_ENVIO = {
  pendiente: { etiqueta: "Enviando…", estilo: "text-slate-500" },
  enviado: { etiqueta: "Enviado por WhatsApp", estilo: "text-emerald-600" },
  fallido: { etiqueta: "No se pudo enviar", estilo: "text-rose-600" },
};

export const formatearFecha = (iso, conHora = true) => {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
};

export const formatearTamano = (bytes) => {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
