import {
  LayoutDashboard,
  FileText,
  History,
  BarChart3,
  UserRound,
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
} from "lucide-react";

import { NavLink } from "react-router-dom";
import { useAuth } from "../../features/auth/hooks/useAuth.js";
import { obtenerIniciales } from "./iniciales.js";

function Sidebar({
  contraido,
  onAlternar,
  movilAbierto,
  onCerrarMovil,
}) {
  const { usuario } = useAuth();
  const nombreFuncionario = usuario?.nombre_completo || "Funcionario";

  const enlaces = [
    {
      nombre: "Dashboard",
      ruta: "/dashboard",
      icono: LayoutDashboard,
    },
    {
      nombre: "Quejas",
      ruta: "/quejas",
      icono: FileText,
    },
    {
      nombre: "Historial",
      ruta: "/historial",
      icono: History,
    },
    {
      nombre: "Reportes",
      ruta: "/reportes",
      icono: BarChart3,
    },
    {
      nombre: "Perfil",
      ruta: "/perfil",
      icono: UserRound,
    },
  ];

  const estiloEnlace = ({ isActive }) =>
    `group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
      isActive
        ? "bg-brand-50 font-semibold text-brand-700"
        : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <>
      {/* FONDO OSCURO PARA MÓVILES */}
      {movilAbierto && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={onCerrarMovil}
          className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
        />
      )}

      {/* MENÚ LATERAL FIJO */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex h-dvh flex-col overflow-hidden
          border-r border-slate-200 bg-white text-slate-600
          transition-[width,transform] duration-300 ease-in-out
          ${contraido ? "md:w-[76px]" : "md:w-64"}
          w-64
          ${movilAbierto ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* ENCABEZADO */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-slate-200 ${
            contraido
              ? "md:justify-center md:px-2 px-5"
              : "px-5"
          }`}
        >
          <div className="flex min-w-0 items-center gap-3 w-full">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Building2 size={20} />
            </div>

            <div
              className={`min-w-0 ${
                contraido ? "md:hidden" : ""
              }`}
            >
              <h1 className="text-base font-semibold tracking-tight text-slate-900">
                VitalIA
              </h1>
              
            </div>
          </div>
        </div>

        {/* ENLACES Y CABECERA DEL MENÚ PRINCIPAL */}
        <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
          
          {/* FILA UNIFICADA: Menú principal + Botón de cerrar (móvil) + Botón de contraer (escritorio) */}
          <div
            className={`mb-3 flex items-center px-3 ${
              contraido ? "md:justify-center" : "justify-between"
            }`}
          >
            <p
              className={`text-xs font-medium text-slate-400 ${
                contraido ? "md:hidden" : ""
              }`}
            >
              Menú principal
            </p>

            <div className="flex items-center gap-1">
              {/* BOTÓN DE CERRAR EN MÓVIL */}
              <button
                type="button"
                onClick={onCerrarMovil}
                aria-label="Cerrar menú"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 md:hidden"
              >
                <X size={18} />
              </button>

              {/* BOTÓN PARA CONTRAER/EXPANDIR EN ESCRITORIO */}
              <button
                type="button"
                onClick={onAlternar}
                aria-label={contraido ? "Expandir menú" : "Contraer menú"}
                title={contraido ? "Expandir menú" : "Contraer menú"}
                className="hidden rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 md:flex"
              >
                {contraido ? (
                  <ChevronRight size={18} />
                ) : (
                  <ChevronLeft size={18} />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {enlaces.map(({ nombre, ruta, icono: Icono }) => (
              <NavLink
                key={ruta}
                to={ruta}
                title={contraido ? nombre : undefined}
                onClick={onCerrarMovil}
                className={estiloEnlace}
              >
                <Icono
                  size={20}
                  className="shrink-0"
                />

                <span
                  className={`whitespace-nowrap ${
                    contraido ? "md:hidden" : ""
                  }`}
                >
                  {nombre}
                </span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* PARTE INFERIOR */}
        <div className="shrink-0 border-t border-slate-200 p-3">
          {/* FUNCIONARIO AUTENTICADO (dato real de la tabla funcionario) */}
          <div
            title={contraido ? nombreFuncionario : undefined}
            className="flex items-center gap-3 rounded-lg px-3 py-2"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold tracking-wide text-slate-600">
              {obtenerIniciales(nombreFuncionario)}
            </div>
            <div className={`min-w-0 ${contraido ? "md:hidden" : ""}`}>
              <p className="truncate text-sm font-medium text-slate-800">{nombreFuncionario}</p>
              {usuario?.usuario && (
                <p className="truncate text-xs text-slate-500">@{usuario.usuario}</p>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;