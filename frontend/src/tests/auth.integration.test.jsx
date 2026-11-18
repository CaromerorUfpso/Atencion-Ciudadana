// Pruebas de integración REAL: React (jsdom) <-> FastAPI <-> PostgreSQL.
// Requieren el backend en VITE_API_URL y un funcionario activo y otro inactivo de una
// base de pruebas desechable (variables TEST_USER/TEST_PASS/TEST_INACTIVE_USER/TEST_INACTIVE_PASS).
// Sin esas variables se omiten.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../features/auth/context/AuthContext.jsx";
import ProtectedRoute from "../features/auth/components/ProtectedRoute.jsx";
import Login from "../features/auth/pages/Login.jsx";
import { useAuth } from "../features/auth/hooks/useAuth.js";
import { api, setCsrfToken } from "../services/api";

const env = process.env;
const U = env.TEST_USER, P = env.TEST_PASS, UI = env.TEST_INACTIVE_USER, PI = env.TEST_INACTIVE_PASS;
const d = U && P ? describe : describe.skip;

function Privada() {
  const { usuario, cerrarSesion } = useAuth();
  return (
    <div>
      <p>Panel de {usuario.nombre_completo}</p>
      <button onClick={cerrarSesion}>Salir</button>
    </div>
  );
}
function App({ inicial = "/panel" }) {
  return (
    <MemoryRouter initialEntries={[inicial]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/panel" element={<Privada />} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}
const escribir = async (usr, pw) => {
  const u = userEvent.setup();
  await u.type(await screen.findByLabelText("Usuario"), usr);
  if (pw) await u.type(screen.getByLabelText("Contraseña"), pw);
  await u.click(screen.getByRole("button", { name: /iniciar sesión/i }));
  return u;
};

d("login React <-> FastAPI real", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    // limpia cookies de la prueba anterior cerrando sesión en el servidor si la hubiera
    try { await api.get("/api/auth/me"); await api.post("/api/auth/logout"); } catch { /* sin sesión */ }
    setCsrfToken(null);
  });

  it("ruta privada sin sesión redirige al login", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: /iniciar sesión/i })).toBeTruthy();
    expect(screen.queryByText(/Panel de/)).toBeNull();
  });

  it("valida campos vacíos sin llamar al servidor", async () => {
    render(<App />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: /iniciar sesión/i }));
    expect(await screen.findByText("Escribe tu usuario.")).toBeTruthy();
    expect(screen.getByText("Escribe tu contraseña.")).toBeTruthy();
  });

  it("credenciales incorrectas muestran error y no entra", async () => {
    render(<App />);
    await escribir(U, "clave-incorrecta-1");
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/no son correctos/);
    expect(screen.queryByText(/Panel de/)).toBeNull();
  });

  it("botón mostrar/ocultar contraseña", async () => {
    render(<App />);
    const u = userEvent.setup();
    const campo = await screen.findByLabelText("Contraseña");
    expect(campo.type).toBe("password");
    await u.click(screen.getByRole("button", { name: /mostrar contraseña/i }));
    expect(campo.type).toBe("text");
  });

  it("login correcto -> panel; sin token en localStorage/sessionStorage; recarga conserva sesión; logout la cierra", async () => {
    const { unmount } = render(<App />);
    await escribir(U, P);
    expect(await screen.findByText(/Panel de/)).toBeTruthy();

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).not.toMatch(/alcaldia_session/); // HttpOnly: JS no la ve

    // "recargar": se desmonta todo (se pierde el estado en memoria) y se vuelve a montar
    unmount();
    setCsrfToken(null);
    render(<App />);
    expect(await screen.findByText(/Panel de/)).toBeTruthy(); // /api/auth/me restauró la sesión

    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Salir" }));
    expect(await screen.findByRole("button", { name: /iniciar sesión/i })).toBeTruthy();
    await expect(api.get("/api/auth/me")).rejects.toMatchObject({ response: { status: 401 } });
  });

  it("sesión vencida/revocada en el servidor: una petición 401 devuelve al login con aviso", async () => {
    render(<App />);
    await escribir(U, P);
    await screen.findByText(/Panel de/);
    // otra pestaña/servidor revoca la sesión: se simula quitando la cookie del navegador
    document.cookie = "alcaldia_session=; Max-Age=0; path=/";
    // la cookie es HttpOnly: en jsdom no se puede borrar por JS, así que se revoca en el servidor
    await api.post("/api/auth/logout");
    await expect(api.get("/api/casos")).rejects.toBeTruthy();
    expect(await screen.findByText(/Tu sesión venció/)).toBeTruthy();
  });
});

const dInact = UI && PI ? describe : describe.skip;
dInact("funcionario inactivo", () => {
  afterEach(cleanup);
  it("muestra el mensaje de cuenta inactiva", async () => {
    render(<App />);
    await escribir(UI, PI);
    const alerta = await screen.findByRole("alert");
    await waitFor(() => expect(alerta.textContent).toMatch(/inactiva/i));
  });
});
