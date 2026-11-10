/**
 * interpolacion.js — Módulo «Interpolación».
 * Conecta la tabla de puntos con el núcleo interp.js y dibuja la gráfica.
 */
import {
  interpolate, formatCoefficient, formatPolynomial, graphRange, samplePolynomial,
} from "./interp.js";
import { formatNumber } from "./core.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const EJEMPLOS = {
  apunte: {
    puntos: [{ x: 0, y: -3 }, { x: 1, y: 0 }, { x: 3, y: 5 }, { x: 6, y: 7 }],
    x: "1.8",
  },
  parabola: {
    puntos: [{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 2 }],
    x: "1.5",
  },
  cubica: {
    puntos: [{ x: -1, y: 3 }, { x: 0, y: 1 }, { x: 1, y: -1 }, { x: 2, y: 3 }],
    x: "0.5",
  },
};

const state = {
  resultado: null,
};

/* ------------------------------------------------------------- utilidades */

function num(texto) {
  if (texto === null || texto === undefined) return NaN;
  const limpio = String(texto).trim().replace(/\s/g, "").replace(",", ".");
  if (limpio === "") return NaN;
  return Number(limpio);
}

function avisar(texto, tipo = "error") {
  const caja = $("#interp-mensajes");
  caja.textContent = texto;
  caja.className = `mensajes ${tipo === "info" ? "info" : ""}`;
}

function limpiarAvisos() {
  const caja = $("#interp-mensajes");
  caja.textContent = "";
  caja.className = "mensajes";
}

/* --------------------------------------------------------------- puntos */

function crearFila(x = "", y = "") {
  const fila = document.createElement("div");
  fila.className = "punto-fila";

  const indice = document.createElement("span");
  indice.className = "indice";

  const inputX = document.createElement("input");
  inputX.type = "text";
  inputX.inputMode = "decimal";
  inputX.autocomplete = "off";
  inputX.className = "punto-x";
  inputX.value = x === "" ? "" : String(x);

  const inputY = document.createElement("input");
  inputY.type = "text";
  inputY.inputMode = "decimal";
  inputY.autocomplete = "off";
  inputY.className = "punto-f";
  inputY.value = y === "" ? "" : String(y);

  const quitar = document.createElement("button");
  quitar.type = "button";
  quitar.className = "punto-quitar";
  quitar.textContent = "×";
  quitar.addEventListener("click", () => {
    if ($$(".punto-fila", $("#interp-puntos")).length <= 2) return;
    fila.remove();
    actualizarFilas();
  });

  fila.append(indice, inputX, inputY, quitar);
  return fila;
}

function actualizarFilas() {
  const filas = $$(".punto-fila", $("#interp-puntos"));
  filas.forEach((fila, i) => {
    $(".indice", fila).textContent = i + 1;
    const [inputX, inputY] = $$("input", fila);
    inputX.setAttribute("aria-label", `x del punto ${i + 1}`);
    inputY.setAttribute("aria-label", `f(x) del punto ${i + 1}`);
    $(".punto-quitar", fila).disabled = filas.length <= 2;
  });
}

function cargarPuntos(puntos, x = null) {
  const contenedor = $("#interp-puntos");
  contenedor.innerHTML = "";
  for (const punto of puntos) contenedor.append(crearFila(punto.x, punto.y));
  actualizarFilas();
  if (x !== null) $("#interp-x").value = String(x);
}

function leerPuntos() {
  // Las filas completamente vacías se ignoran: así «Añadir punto» no obliga
  // a completar una fila que el usuario finalmente no usó.
  const filas = $$(".punto-fila", $("#interp-puntos")).filter((fila) => {
    const [inputX, inputY] = $$("input", fila);
    return String(inputX.value).trim() !== "" || String(inputY.value).trim() !== "";
  });

  if (filas.length < 2) throw new Error("Se necesitan al menos dos puntos.");

  return filas.map((fila, i) => {
    const [inputX, inputY] = $$("input", fila);
    const x = num(inputX.value);
    const y = num(inputY.value);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`Completa las coordenadas numéricas del punto ${i + 1}.`);
    }
    return { x, y };
  });
}

/* -------------------------------------------------------------- resolución */

function resolver() {
  limpiarAvisos();
  let resultado;

  try {
    const puntos = leerPuntos();
    const x = num($("#interp-x").value);
    if (!Number.isFinite(x)) throw new Error("El valor de x para evaluar debe ser numérico.");
    resultado = interpolate(puntos, x);
  } catch (error) {
    avisar(error.message);
    $("#interp-resultados").hidden = true;
    return;
  }

  state.resultado = resultado;
  pintarResumen(resultado);
  pintarTablas(resultado);
  $("#interp-exportar").disabled = false;
  $("#interp-resultados").hidden = false;
  requestAnimationFrame(() => dibujarGrafica(resultado));
  $("#interp-resultados").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------------------------------------------------------------- resumen */

function pintarResumen(r) {
  const contenedor = $("#interp-resumen");
  contenedor.innerHTML = "";
  const textoLagrange = formatPolynomial(r.lagrange.coefficients);
  const textoNewton = formatPolynomial(r.newton.polynomial);

  const tarjeta = (nombre, grado, polinomio, valor, meta) => {
    const card = document.createElement("article");
    card.className = "metodo-card ok";
    card.innerHTML = `
      <h3>${nombre}</h3>
      <span class="pill ok">Grado ${grado}</span>
      <p class="polinomio">P(x) = ${polinomio}</p>
      <p class="meta">P(${formatNumber(r.x, 6)}) = ${formatNumber(valor, 10)}</p>
      <p class="meta">${meta}</p>`;
    return card;
  };

  contenedor.append(
    tarjeta("Lagrange", r.lagrange.degree, textoLagrange, r.lagrange.value,
      `${r.points.length} puntos · bases cardinales`),
    tarjeta("Newton", r.newton.degree, textoNewton, r.newton.value,
      `${r.points.length} puntos · diferencias divididas`),
  );

  const nota = document.createElement("p");
  nota.className = "hint";
  nota.textContent =
    `Ambos métodos producen el mismo polinomio (unicidad). ` +
    `Diferencia numérica: ${formatNumber(r.difference, 3)}.`;
  contenedor.append(nota);
}

/* ---------------------------------------------------------------- tablas */

function pintarTablas(r) {
  const n = r.points.length;
  const encabezados = ["x<sub>i</sub>", "f<sub>i</sub>"];
  for (let j = 1; j < n; j++) encabezados.push(`${j}.ª`);

  const filas = r.points.map((p, i) => {
    const celdas = [`<td>${formatCoefficient(p.x)}</td>`, `<td>${formatCoefficient(p.y)}</td>`];
    for (let j = 1; j < n; j++) {
      const valor = i + j < n ? r.newton.table[i][j] : null;
      celdas.push(`<td>${valor === null ? "" : formatCoefficient(valor)}</td>`);
    }
    return `<tr>${celdas.join("")}</tr>`;
  });

  $("#interp-tabla-diferencias").innerHTML = `
    <table>
      <caption class="sr-only">Tabla de diferencias divididas de Newton</caption>
      <thead><tr>${encabezados.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>
      <tbody>${filas.join("")}</tbody>
    </table>`;

  const coefFilas = r.lagrange.coefficients.map((valor, k) => `
    <tr>
      <td>${k}</td>
      <td>${formatCoefficient(valor)}</td>
      <td>${formatCoefficient(r.newton.coefficients[k])}</td>
    </tr>`).join("");

  $("#interp-tabla-coeficientes").innerHTML = `
    <table>
      <caption class="sr-only">Coeficientes de Lagrange y de Newton</caption>
      <thead>
        <tr><th scope="col">k</th><th scope="col">a<sub>k</sub> (Lagrange)</th><th scope="col">f[x<sub>0</sub>,…,x<sub>k</sub>] (Newton)</th></tr>
      </thead>
      <tbody>${coefFilas}</tbody>
    </table>`;
}

/* --------------------------------------------------------------- gráfica */

function escalaLimpia(min, max, divisiones) {
  const rango = (max - min) || 1;
  const bruto = rango / divisiones;
  const exponente = Math.floor(Math.log10(bruto));
  const fraccion = bruto / 10 ** exponente;
  const paso = (fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 5 ? 5 : 10) * 10 ** exponente;
  return {
    desde: Math.floor(min / paso) * paso,
    hasta: Math.ceil(max / paso) * paso,
    paso,
  };
}

function marcas({ desde, hasta, paso }) {
  const valores = [];
  for (let i = 0; i <= 24; i++) {
    const v = desde + i * paso;
    if (v > hasta + paso * 1e-6) break;
    valores.push(Math.abs(v) < paso * 1e-6 ? 0 : v);
  }
  return valores;
}

function dibujarGrafica(r) {
  const canvas = $("#interp-grafica");
  if (!canvas) return;
  const contexto = canvas.getContext("2d");
  const ancho = canvas.clientWidth;
  const alto = canvas.clientHeight;
  if (!ancho || !alto) return;

  const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(ancho * ratio);
  canvas.height = Math.round(alto * ratio);
  contexto.setTransform(ratio, 0, 0, ratio, 0, 0);

  const estilo = getComputedStyle(document.documentElement);
  const color = (nombre) => estilo.getPropertyValue(nombre).trim();
  const tinta = color("--ink");
  const tenue = color("--muted");
  const linea = color("--line");
  const acento = color("--accent");
  const verde = color("--verde");
  const naranja = color("--warn");

  const xs = r.points.map((p) => p.x);
  const rango = graphRange(r.points, r.lagrange.coefficients);
  const xminDatos = Math.min(...xs, r.x);
  const xmaxDatos = Math.max(...xs, r.x);
  const margenX = (xmaxDatos - xminDatos) * 0.15 || 1;
  rango.xmin = xminDatos - margenX;
  rango.xmax = xmaxDatos + margenX;
  rango.ymin = Math.min(rango.ymin, r.lagrange.value);
  rango.ymax = Math.max(rango.ymax, r.lagrange.value);

  const escalaX = escalaLimpia(rango.xmin, rango.xmax, 5);
  const escalaY = escalaLimpia(rango.ymin, rango.ymax, 4);
  const margenIzq = 50;
  const margenDer = 12;
  const margenSup = 34;
  const margenInf = 30;
  const X = (v) => margenIzq + ((v - escalaX.desde) / (escalaX.hasta - escalaX.desde)) * (ancho - margenIzq - margenDer);
  const Y = (v) => margenSup + (1 - (v - escalaY.desde) / (escalaY.hasta - escalaY.desde)) * (alto - margenSup - margenInf);

  contexto.clearRect(0, 0, ancho, alto);

  // Rejilla
  contexto.strokeStyle = linea;
  contexto.lineWidth = 1;
  for (const v of marcas(escalaY)) {
    const y = Y(v);
    contexto.beginPath();
    contexto.moveTo(margenIzq, y);
    contexto.lineTo(ancho - margenDer, y);
    contexto.stroke();
  }
  for (const v of marcas(escalaX)) {
    const x = X(v);
    contexto.beginPath();
    contexto.moveTo(x, margenSup);
    contexto.lineTo(x, alto - margenInf);
    contexto.stroke();
  }

  // Ejes
  contexto.strokeStyle = tenue;
  contexto.lineWidth = 1.4;
  if (escalaY.desde < 0 && escalaY.hasta > 0) {
    contexto.beginPath();
    contexto.moveTo(margenIzq, Y(0));
    contexto.lineTo(ancho - margenDer, Y(0));
    contexto.stroke();
  }
  if (escalaX.desde < 0 && escalaX.hasta > 0) {
    contexto.beginPath();
    contexto.moveTo(X(0), margenSup);
    contexto.lineTo(X(0), alto - margenInf);
    contexto.stroke();
  }

  // Curva
  const muestras = samplePolynomial(r.lagrange.coefficients, escalaX.desde, escalaX.hasta, 600);
  contexto.strokeStyle = verde;
  contexto.lineWidth = 2.6;
  contexto.lineJoin = "round";
  contexto.beginPath();
  let dibujando = false;
  const rangoY = escalaY.hasta - escalaY.desde;
  for (const p of muestras) {
    if (!Number.isFinite(p.y) || p.y < escalaY.desde - rangoY || p.y > escalaY.hasta + rangoY) {
      dibujando = false;
      continue;
    }
    const px = X(p.x);
    const py = Y(p.y);
    if (!dibujando) {
      contexto.moveTo(px, py);
      dibujando = true;
    } else {
      contexto.lineTo(px, py);
    }
  }
  contexto.stroke();

  // Punto evaluado y línea vertical
  if (r.x >= escalaX.desde && r.x <= escalaX.hasta) {
    contexto.save();
    contexto.setLineDash([5, 4]);
    contexto.strokeStyle = naranja;
    contexto.lineWidth = 1.7;
    contexto.beginPath();
    contexto.moveTo(X(r.x), margenSup);
    contexto.lineTo(X(r.x), alto - margenInf);
    contexto.stroke();
    contexto.restore();

    contexto.fillStyle = naranja;
    contexto.beginPath();
    contexto.arc(X(r.x), Y(r.lagrange.value), 5, 0, Math.PI * 2);
    contexto.fill();
  }

  // Puntos
  for (const [i, p] of r.points.entries()) {
    const px = X(p.x);
    const py = Y(p.y);
    contexto.fillStyle = acento;
    contexto.beginPath();
    contexto.arc(px, py, 5.2, 0, Math.PI * 2);
    contexto.fill();
    contexto.strokeStyle = color("--card");
    contexto.lineWidth = 1.4;
    contexto.stroke();

    if (r.points.length <= 7) {
      contexto.fillStyle = tinta;
      contexto.font = "11px system-ui, sans-serif";
      contexto.textAlign = px > ancho - 40 ? "right" : "left";
      contexto.textBaseline = "bottom";
      contexto.fillText(`P${i}`, px + (px > ancho - 40 ? -7 : 7), py - 6);
    }
  }

  // Etiquetas
  contexto.fillStyle = tenue;
  contexto.font = "11px system-ui, sans-serif";
  contexto.textBaseline = "top";
  const textosX = marcas(escalaX);
  for (let i = 0; i < textosX.length; i++) {
    const v = textosX[i];
    contexto.textAlign = i === 0 ? "left" : i === textosX.length - 1 ? "right" : "center";
    contexto.fillText(formatNumber(v, 3), X(v), alto - margenInf + 6);
  }
  contexto.textAlign = "right";
  contexto.textBaseline = "middle";
  for (const v of marcas(escalaY)) {
    contexto.fillText(formatNumber(v, 3), margenIzq - 7, Y(v));
  }

  // Leyenda
  contexto.textBaseline = "middle";
  contexto.font = "11px system-ui, sans-serif";
  const leyendaY = 15;
  contexto.fillStyle = acento;
  contexto.beginPath();
  contexto.arc(margenIzq + 4, leyendaY, 4, 0, Math.PI * 2);
  contexto.fill();
  contexto.fillStyle = tenue;
  contexto.textAlign = "left";
  contexto.fillText("Puntos", margenIzq + 13, leyendaY);

  contexto.strokeStyle = verde;
  contexto.lineWidth = 2.5;
  contexto.beginPath();
  contexto.moveTo(margenIzq + 75, leyendaY);
  contexto.lineTo(margenIzq + 96, leyendaY);
  contexto.stroke();
  contexto.fillStyle = tenue;
  contexto.fillText("Polinomio", margenIzq + 102, leyendaY);

  contexto.fillStyle = naranja;
  contexto.beginPath();
  contexto.arc(margenIzq + 190, leyendaY, 4, 0, Math.PI * 2);
  contexto.fill();
  contexto.fillStyle = tenue;
  contexto.fillText(`x = ${formatNumber(r.x, 4)}`, margenIzq + 199, leyendaY);
}

/* -------------------------------------------------------------------- CSV */

function exportarCSV() {
  const r = state.resultado;
  if (!r) return;

  const lineas = ["seccion;indice;x;valor"];
  r.points.forEach((p, i) => lineas.push(`punto;${i};${p.x};${p.y}`));
  r.lagrange.coefficients.forEach((v, k) => lineas.push(`lagrange_coef;${k};;${v}`));
  r.newton.coefficients.forEach((v, k) => lineas.push(`newton_coef;${k};;${v}`));
  lineas.push(`evaluacion;0;${r.x};${r.lagrange.value}`);

  const contenido = "\ufeff" + lineas.join("\n");
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "interpolacion.csv";
  enlace.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------ ejemplos/URL */

function aplicarEjemplo(clave) {
  const ejemplo = EJEMPLOS[clave];
  if (!ejemplo) return;
  cargarPuntos(ejemplo.puntos, ejemplo.x);
  limpiarAvisos();
}

function leerParametros() {
  const params = new URLSearchParams(location.search);
  if (!params.has("puntos")) return { run: false };

  const puntos = params.get("puntos").split(";").map((par) => {
    const [x, y] = par.split(",");
    return { x: num(x), y: num(y) };
  });
  const x = params.has("x") ? params.get("x") : $("#interp-x").value;
  try {
    cargarPuntos(puntos, x);
  } catch {
    // Se validará al resolver.
  }
  return { run: params.get("run") === "1" };
}

/* ------------------------------------------------------------------ arranque */

export function initInterpolacion() {
  cargarPuntos(EJEMPLOS.apunte.puntos, EJEMPLOS.apunte.x);

  $("#interp-agregar").addEventListener("click", () => {
    const fila = crearFila();
    $("#interp-puntos").append(fila);
    actualizarFilas();
    $(".punto-x", fila)?.focus();
  });

  $$(".chip[data-interp-ejemplo]").forEach((boton) => {
    boton.addEventListener("click", () => aplicarEjemplo(boton.dataset.interpEjemplo));
  });

  $("#interp-resolver").addEventListener("click", resolver);
  $("#interp-exportar").addEventListener("click", exportarCSV);
  document.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter" || !evento.target.matches("input")) return;
    if (!evento.target.closest("#vista-interpolacion")) return;
    evento.preventDefault();
    resolver();
  });

  let temporizador;
  window.addEventListener("resize", () => {
    if ($("#interp-resultados").hidden) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      if (state.resultado) dibujarGrafica(state.resultado);
    }, 150);
  });

  const parametros = leerParametros();
  if (parametros.run) resolver();

  return {
    redibujar() {
      if (!$("#interp-resultados").hidden && state.resultado) dibujarGrafica(state.resultado);
    },
  };
}
