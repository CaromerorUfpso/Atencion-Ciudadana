import { useCallback, useEffect, useState } from "react";

const CLAVE = "tema";

function temaInicial() {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === "oscuro" || guardado === "claro") return guardado;
  } catch {
    
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
}

export function useTema() {
  const [tema, setTema] = useState(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "oscuro");
    try {
      localStorage.setItem(CLAVE, tema);
    } catch {
      
    }
  }, [tema]);

  const alternar = useCallback(
    () => setTema((actual) => (actual === "oscuro" ? "claro" : "oscuro")),
    []
  );

  return { tema, alternar };
}