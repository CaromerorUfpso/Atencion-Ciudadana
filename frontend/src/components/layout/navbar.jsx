import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/hooks/useAuth.js";
import { obtenerIniciales } from "./iniciales.js";
import {
  Menu,
  UserRound,
  LogOut,
  Settings,
  LayoutDashboard,
  MessageSquareWarning,
  History,
  BarChart3,
  User,
  Sliders,
  Moon,
  Sun,
} from "lucide-react";
import { useTema } from "../../hooks/useTema.js";
// Configuración de títulos e iconos sencillos (sin fondo azul) para cada ruta
const PAGINAS_CONFIG = {
  "/": {
    titulo: "Dashboard",
    descripcion: "Resumen general de las quejas y dudas recibidas desde WhatsApp.",
    icono: LayoutDashboard,
  },
  "/dashboard": {
    titulo: "Dashboard",
    descripcion: "Resumen general de las quejas y dudas recibidas desde WhatsApp.",
    icono: LayoutDashboard,
  },
  "/quejas": {
    titulo: "Gestión de Quejas y Dudas",
    descripcion: "Clasifica, atiende y da solución a los reportes de WhatsApp.",
    icono: MessageSquareWarning,
  },
  "/historial": {
    titulo: "Historial de Atenciones",
    descripcion: "Consulta el registro histórico de quejas y dudas resueltas.",
    icono: History,
  },
  "/reportes": {
    titulo: "Reportes y Métricas",
    descripcion: "Análisis analítico de la atención de quejas y dudas.",
    icono: BarChart3,
  },
  "/perfil": {
    titulo: "Mi Perfil",
    descripcion: "Administra tu información personal y credenciales de acceso.",
    icono: User,
  },
  "/configuracion": {
    titulo: "Configuración",
    descripcion: "Ajusta las preferencias generales del sistema.",
    icono: Sliders,
  },
};

function Navbar({ onAbrirMenu }) {
  const { usuario, cerrarSesion: cerrarSesionServidor } = useAuth();
  const { tema, alternar } = useTema();
  const [menuPerfilAbierto, setMenuPerfilAbierto] = useState(false);

  const menuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Obtener la configuración de la página actual o valores por defecto
  const paginaActual = PAGINAS_CONFIG[location.pathname] || {
    titulo: "Vitalia",
    descripcion: "Plataforma de gestión y atención.",
    icono: LayoutDashboard,
  };

  const IconoPagina = paginaActual.icono;

  useEffect(() => {
    const cerrarAlHacerClicFuera = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setMenuPerfilAbierto(false);
      }
    };

    document.addEventListener("mousedown", cerrarAlHacerClicFuera);

    return () => {
      document.removeEventListener(
        "mousedown",
        cerrarAlHacerClicFuera
      );
    };
  }, []);

  const cerrarSesion = async () => {
    setMenuPerfilAbierto(false);
    await cerrarSesionServidor(); // revoca la sesión en el servidor
    navigate("/login", { replace: true });
  };

  // Datos reales de `funcionario`. La base no tiene correo, foto ni rol.
  const nombre = usuario?.nombre_completo || "Funcionario";
  const correo = usuario?.usuario ? `@${usuario.usuario}` : "";
  const estadoCuenta = usuario?.activo ? "Cuenta activa" : "Cuenta inactiva";
  const iniciales = obtenerIniciales(nombre);

  return (
    <header className="sticky top-0 z-35 flex h-16 min-w-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">

      {/* IZQUIERDA: Icono sencillo + Título y Descripción debajo */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onAbrirMenu}
          aria-label="Abrir menú de navegación"
          className="shrink-0 rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 md:hidden"
        >
          <Menu size={22} />
        </button>

        <div className="flex items-center gap-3 min-w-0">
          {/* Icono sencillo, sin fondo */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center text-slate-500">
            <IconoPagina size={21} strokeWidth={1.75} />
          </div>
          
          {/* Título de la página y su descripción debajo */}
          <div className="min-w-0 flex flex-col justify-center">
            <h2 className="truncate text-base font-semibold leading-tight tracking-tight text-slate-900">
              {paginaActual.titulo}
            </h2>
            <p className="mt-0.5 hidden truncate text-xs font-normal text-slate-500 sm:block">
              {paginaActual.descripcion}
            </p>
          </div>
        </div>
      </div>

      
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
              
        <button
          type="button"
          onClick={alternar}
          aria-label={tema === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          title={tema === "oscuro" ? "Modo claro" : "Modo oscuro"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          {tema === "oscuro" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() =>
              setMenuPerfilAbierto((abierto) => !abierto)
            }
            aria-label="Abrir menú del perfil"
            aria-expanded={menuPerfilAbierto}
            title={nombre}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold tracking-wide text-white transition hover:bg-brand-700 aria-expanded:ring-4 aria-expanded:ring-brand-600/15"
          >
            {iniciales}
          </button>

          {menuPerfilAbierto && (
            <div className="absolute right-0 top-full z-50 mt-2 w-[min(264px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5">

              {/* INFORMACIÓN DEL USUARIO */}
              <div className="border-b border-slate-100 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold tracking-wide text-white">
                    {iniciales}
                  </div>

                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold leading-snug text-slate-900">
                      {nombre}
                    </p>
                    <p className="break-all text-xs text-slate-500">
                      {correo}
                    </p>
                    <span className="mt-1.5 inline-flex rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                      {estadoCuenta}
                    </span>
                  </div>
                </div>
              </div>

              {/* OPCIONES */}
              <div className="p-1.5 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setMenuPerfilAbierto(false);
                    navigate("/perfil");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-slate-700 transition hover:bg-slate-100"
                >
                  <UserRound size={16} className="text-slate-400" />
                  Mi perfil
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuPerfilAbierto(false);
                    navigate("/perfil");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-slate-700 transition hover:bg-slate-100"
                >
                  <Settings size={16} className="text-slate-400" />
                  Configuración
                </button>

                <div className="my-1 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={cerrarSesion}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  <LogOut size={16} />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;