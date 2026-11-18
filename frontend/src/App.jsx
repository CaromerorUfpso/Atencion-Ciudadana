import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Sidebar from "./components/layout/sidebar.jsx";
import Navbar from "./components/layout/navbar.jsx";

import Login from "./features/auth/pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Quejas from "./features/tickets/pages/Quejas.jsx";
import Historial from "./pages/Historial.jsx";
import Reportes from "./pages/Reportes.jsx";
import Perfil from "./pages/Perfil.jsx";

import { AuthProvider } from "./features/auth/context/AuthContext.jsx";
import { useAuth } from "./features/auth/hooks/useAuth.js";
import ProtectedRoute, { PantallaCarga } from "./features/auth/components/ProtectedRoute.jsx";

function SoloInvitados() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <PantallaCarga />;
  return usuario ? <Navigate to="/dashboard" replace /> : <Login />;
}

function AppLayout() {
  const [menuContraido, setMenuContraido] = useState(false);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  return (
    <>
      <div className="min-h-screen">
        <Sidebar
          contraido={menuContraido}
          onAlternar={() => setMenuContraido((actual) => !actual)}
          movilAbierto={menuMovilAbierto}
          onCerrarMovil={() => setMenuMovilAbierto(false)}
        />

        {/* CONTENIDO PRINCIPAL */}
        <div
          className={`
            min-h-screen min-w-0 transition-[margin] duration-300
            ${menuContraido ? "md:ml-[76px]" : "md:ml-64"}
          `}
        >
          <Navbar
            onAbrirMenu={() => setMenuMovilAbierto(true)}
          />

          <main className="mx-auto w-full min-w-0 max-w-[1400px] p-4 sm:p-6 lg:p-8">
            <Routes>
              <Route
                path="/dashboard"
                element={<Dashboard />}
              />
              <Route
                path="/quejas"
                element={<Quejas />}
              />
              <Route
                path="/historial"
                element={<Historial />}
              />
              <Route
                path="/reportes"
                element={<Reportes />}
              />
              <Route
                path="/perfil"
                element={<Perfil />}
              />
              <Route
                path="*"
                element={<Navigate to="/dashboard" replace />}
              />
            </Routes>
          </main>
        </div>
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={<SoloInvitados />}
          />

          <Route element={<ProtectedRoute />}>
            <Route path="/*" element={<AppLayout />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
