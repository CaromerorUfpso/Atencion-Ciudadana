import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Building2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import { mensajeDeError } from "../../../services/api";

function Login() {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [recordarme, setRecordarme] = useState(false);
  const [error, setError] = useState("");
  const [errores, setErrores] = useState({});
  const [cargando, setCargando] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { iniciarSesion, avisoSesion } = useAuth();

  const validar = () => {
    const nuevos = {};
    const u = usuario.trim();
    if (!u) nuevos.usuario = "Escribe tu usuario.";
    else if (/\s/.test(u)) nuevos.usuario = "El usuario no puede contener espacios.";
    else if (u.length > 50) nuevos.usuario = "El usuario es demasiado largo.";
    if (!contrasena) nuevos.contrasena = "Escribe tu contraseña.";
    else if (new TextEncoder().encode(contrasena).length > 72)
      nuevos.contrasena = "La contraseña es demasiado larga.";
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const iniciar = async (e) => {
    e.preventDefault();
    setError("");
    if (!validar()) return;

    setCargando(true);
    try {
      await iniciarSesion({ usuario: usuario.trim(), password: contrasena, recordarme });
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (err) {
      const estado = err?.response?.status;
      setError(
        estado === 401
          ? "El usuario o la contraseña no son correctos. Verifica tus datos e inténtalo de nuevo."
          : mensajeDeError(err, "No fue posible iniciar sesión.")
      );
      setContrasena("");
      setCargando(false);
    }
  };

  const claseCampo =
    "h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10 aria-invalid:border-red-400 aria-invalid:focus:ring-red-500/10";

  return (
    <main className="flex min-h-dvh flex-col bg-[#f5f6f8]">
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">

          {/* MARCA */}
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Building2 size={22} />
            </div>

            <div>
              <p className="text-base font-semibold leading-tight text-slate-900">
                AlcaldIA
              </p>
              <p className="text-xs text-slate-500">
                Gestión ciudadana
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-7 sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Bienvenido de nuevo
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Ingresa tus credenciales institucionales para continuar
              al panel de gestión.
            </p>

            <form onSubmit={iniciar} noValidate className="mt-7 space-y-5">

              {/* USUARIO */}
              <div>
                <label
                  htmlFor="usuario"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Usuario
                </label>

                <input
                  id="usuario"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Tu nombre de usuario"
                  aria-invalid={Boolean(errores.usuario)}
                  aria-describedby={errores.usuario ? "usuario-error" : undefined}
                  className={claseCampo}
                />
                {errores.usuario && (
                  <p id="usuario-error" className="mt-1.5 text-xs text-red-600">
                    {errores.usuario}
                  </p>
                )}
              </div>

              {/* CONTRASEÑA */}
              <div>
                <label
                  htmlFor="contrasena"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Contraseña
                </label>

                <div className="relative">
                  <input
                    id="contrasena"
                    type={mostrarContrasena ? "text" : "password"}
                    autoComplete="current-password"
                    value={contrasena}
                    onChange={(e) => setContrasena(e.target.value)}
                    placeholder="Escribe tu contraseña"
                    aria-invalid={Boolean(errores.contrasena)}
                    aria-describedby={errores.contrasena ? "contrasena-error" : undefined}
                    className={`${claseCampo} pr-12`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setMostrarContrasena((actual) => !actual)
                    }
                    aria-label={
                      mostrarContrasena
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    {mostrarContrasena ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
                {errores.contrasena && (
                  <p id="contrasena-error" className="mt-1.5 text-xs text-red-600">
                    {errores.contrasena}
                  </p>
                )}
              </div>

              {/* OPCIÓN DE SESIÓN */}
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={recordarme}
                  onChange={(e) => setRecordarme(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                />
                Mantener la sesión
              </label>

              {/* SESIÓN VENCIDA */}
              {avisoSesion && !error && (
                <div
                  role="status"
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm leading-5 text-amber-800"
                >
                  {avisoSesion}
                </div>
              )}

              {/* MENSAJE DE ERROR */}
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-5 text-red-700"
                >
                  {error}
                </div>
              )}

              {/* BOTÓN */}
              <button
                type="submit"
                disabled={cargando}
                aria-busy={cargando}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
              >
                {cargando && <Loader2 size={18} className="animate-spin" />}
                {cargando ? "Ingresando..." : "Iniciar sesión"}
              </button>
            </form>
          </div>

          {/* AYUDA */}
          <p className="mt-6 text-center text-xs leading-5 text-slate-500">
            ¿No puedes ingresar? Si olvidaste tu usuario o tu contraseña, o tu
            cuenta aparece como inactiva, comunícate con el administrador de la
            plataforma.
          </p>
        </div>
      </div>

      <p className="px-5 pb-6 text-center text-xs text-slate-400">
        Acceso restringido a personal autorizado de la Alcaldía.
      </p>
    </main>
  );
}

export default Login;
