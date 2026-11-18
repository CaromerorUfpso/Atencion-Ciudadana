import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

export function PantallaCarga() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500" role="status">
      Verificando sesión...
    </div>
  );
}

export default function ProtectedRoute() {
  const { usuario, cargando } = useAuth();
  const location = useLocation();
  if (cargando) return <PantallaCarga />;
  if (!usuario) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
