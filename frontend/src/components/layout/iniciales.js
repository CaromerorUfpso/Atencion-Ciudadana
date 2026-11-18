// Iniciales para el avatar: primera letra del primer y del último nombre/apellido.
// "Juan Pérez" -> "JP" · "María" -> "M" · sin nombre -> "F".
export function obtenerIniciales(nombre) {
  const palabras = String(nombre ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (palabras.length === 0) return "F";
  const primera = Array.from(palabras[0])[0];
  const ultima = palabras.length > 1 ? Array.from(palabras[palabras.length - 1])[0] : "";
  return `${primera}${ultima}`.toLocaleUpperCase("es");
}
