/**
 * app.js — Arranque de la aplicación y navegación entre módulos.
 */
import { initRaices } from "./raices.js";
import { initSistemas } from "./sistemas.js";
import { initInterpolacion } from "./interpolacion.js";
import { initIntegracion } from "./integracion.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const raices = initRaices();
const sistemas = initSistemas();
const interpolacion = initInterpolacion();
const integracion = initIntegracion();

const paneles = {
  raices: $("#vista-raices"),
  sistemas: $("#vista-sistemas"),
  interpolacion: $("#vista-interpolacion"),
  integracion: $("#vista-integracion"),
};

const botones = $$(".modo");

function vistaPedida() {
  if (location.hash === "#sistemas") return "sistemas";
  if (location.hash === "#interpolacion") return "interpolacion";
  if (location.hash === "#integracion") return "integracion";
  if (location.hash === "#raices") return "raices";
  const params = new URLSearchParams(location.search);
  if (params.get("modo") === "integracion" || params.has("int")) return "integracion";
  if (params.get("modo") === "interpolacion" || params.has("puntos")) return "interpolacion";
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

  const modulos = { raices, sistemas, interpolacion, integracion };
  requestAnimationFrame(() => {
    modulos[activa].redibujar();
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

/* --------------------------------------------------------- instalar PWA */

const avisoInstalar = $("#instalar-aviso");
const botonInstalar = $("#instalar-btn");
const botonCerrar = $("#instalar-cerrar");
const botonAyuda = $("#instalar-ayuda-btn");
const dialogoAyuda = $("#instalar-ayuda");
let promptInstalar = null;

function estaInstalada() {
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true,
  );
}

function abrirAyudaInstalar() {
  if (!dialogoAyuda) return;
  if (typeof dialogoAyuda.showModal === "function") {
    if (!dialogoAyuda.open) dialogoAyuda.showModal();
  } else {
    dialogoAyuda.setAttribute("open", "");
  }
}

window.addEventListener("beforeinstallprompt", (evento) => {
  if (estaInstalada()) return;
  evento.preventDefault();
  promptInstalar = evento;
  avisoInstalar.hidden = false;
});

botonInstalar?.addEventListener("click", async () => {
  if (!promptInstalar) {
    abrirAyudaInstalar();
    return;
  }
  promptInstalar.prompt();
  try {
    await promptInstalar.userChoice;
  } catch {
    // Si el navegador cancela el diálogo, no hay nada más que hacer.
  }
  promptInstalar = null;
  avisoInstalar.hidden = true;
});

botonCerrar?.addEventListener("click", () => {
  avisoInstalar.hidden = true;
});

botonAyuda?.addEventListener("click", abrirAyudaInstalar);

window.addEventListener("appinstalled", () => {
  promptInstalar = null;
  avisoInstalar.hidden = true;
});

if (dialogoAyuda) {
  dialogoAyuda.addEventListener("click", (evento) => {
    if (evento.target !== dialogoAyuda) return;
    if (typeof dialogoAyuda.close === "function") dialogoAyuda.close();
    else dialogoAyuda.removeAttribute("open");
  });
}

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
