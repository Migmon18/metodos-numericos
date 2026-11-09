/**
 * app.js — Arranque de la aplicación y navegación entre módulos.
 */
import { initRaices } from "./raices.js";
import { initSistemas } from "./sistemas.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const raices = initRaices();
const sistemas = initSistemas();

const paneles = {
  raices: $("#vista-raices"),
  sistemas: $("#vista-sistemas"),
};

const botones = $$(".modo");

function vistaPedida() {
  if (location.hash === "#sistemas") return "sistemas";
  if (location.hash === "#raices") return "raices";
  const params = new URLSearchParams(location.search);
  if (params.get("modo") === "sistemas" || params.has("sistema") || params.has("A")) return "sistemas";
  return "raices";
}

function mostrar(vista, { actualizarUrl = true } = {}) {
  const activa = vista in paneles ? vista : "raices";

  for (const [nombre, panel] of Object.entries(paneles)) {
    panel.hidden = nombre !== activa;
  }
  for (const boton of botones) {
    boton.setAttribute("aria-selected", String(boton.dataset.vista === activa));
  }

  if (actualizarUrl) {
    const base = location.pathname + location.search;
    history.replaceState(null, "", `${base}#${activa}`);
  }

  requestAnimationFrame(() => {
    (activa === "raices" ? raices : sistemas).redibujar();
  });
}

for (const boton of botones) {
  boton.addEventListener("click", () => {
    mostrar(boton.dataset.vista);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

window.addEventListener("hashchange", () => mostrar(vistaPedida(), { actualizarUrl: false }));

// Si el enlace trae ?f=…, el módulo de raíces ya cargó los datos; el hash manda
// solo cuando pide explícitamente el módulo de sistemas.
mostrar(vistaPedida(), { actualizarUrl: false });

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
