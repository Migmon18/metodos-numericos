/**
 * edos.js — Módulo «EDO».
 * Conecta f(t,y), la condición inicial y los pasos con ode.js.
 */
import { parseExpression, ParseError, formatNumber } from "./core.js";
import { solveODE, sampleFunction, OdeError } from "./ode.js";
import { solveExact, isLinearODE } from "./exact.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const EJEMPLOS = {
  cuadratica: {
    f: "2*t*y", t0: "0", y0: "1", h: "0.1", N: "4",
    exacta: "exp(t^2)", ft: "", fy: "",
  },
  lineal: {
    f: "t+y", t0: "0", y0: "1", h: "0.1", N: "4",
    exacta: "2*exp(t)-t-1", ft: "", fy: "",
  },
  riccati: {
    f: "y-t^2+1", t0: "0", y0: "0.5", h: "0.2", N: "4",
    exacta: "(t+1)^2-0.5*exp(t)", ft: "", fy: "",
  },
};

const METODOS = [
  { clave: "euler", nombre: "Euler", orden: "Orden 1", colorVar: "--muted" },
  { clave: "eulerModified", nombre: "Euler modificado", orden: "Orden 2", colorVar: "--accent" },
  { clave: "taylor3", nombre: "Taylor 3 términos", orden: "Orden 2", colorVar: "--warn" },
  { clave: "rk4", nombre: "Runge-Kutta 4", orden: "Orden 4", colorVar: "--verde" },
];

const state = { datos: null };

function num(texto) {
  if (texto === null || texto === undefined) return NaN;
  const limpio = String(texto).trim().replace(/\s/g, "").replace(",", ".");
  if (limpio === "") return NaN;
  return Number(limpio);
}

function avisar(texto, tipo = "error") {
  const caja = $("#edo-mensajes");
  caja.textContent = texto;
  caja.className = `mensajes ${tipo === "info" ? "info" : ""}`;
}

function limpiarAvisos() {
  const caja = $("#edo-mensajes");
  caja.textContent = "";
  caja.className = "mensajes";
}

function compilar(expr, variables, etiqueta) {
  try {
    return parseExpression(expr, variables);
  } catch (error) {
    if (error instanceof ParseError) {
      throw new Error(`${etiqueta}: ${error.message}`);
    }
    throw error;
  }
}

function leerDatos() {
  const f = compilar($("#edo-funcion").value, ["t", "y"], "f(t,y)");
  const t0 = num($("#edo-t0").value);
  const y0 = num($("#edo-y0").value);
  const h = num($("#edo-h").value);
  const N = num($("#edo-n").value);

  if (!Number.isFinite(t0) || !Number.isFinite(y0)) throw new Error("t₀ y y₀ deben ser números.");
  if (!Number.isFinite(h) || h <= 0) throw new Error("El paso h debe ser positivo.");
  if (!Number.isInteger(N) || N < 1) throw new Error("N debe ser un entero al menos 1.");

  let exactaTexto = $("#edo-exacta").value.trim();
  let autoExacta = false;
  if (exactaTexto === "") {
    const sugerida = solveExact($("#edo-funcion").value, t0, y0);
    if (sugerida) {
      exactaTexto = sugerida;
      $("#edo-exacta").value = sugerida;
      autoExacta = true;
    }
  }
  const exacta = exactaTexto === "" ? null : compilar(exactaTexto, ["t"], "Solución exacta");
  const ftTexto = $("#edo-ft").value.trim();
  const fyTexto = $("#edo-fy").value.trim();
  const ft = ftTexto === "" ? null : compilar(ftTexto, ["t", "y"], "∂f/∂t");
  const fy = fyTexto === "" ? null : compilar(fyTexto, ["t", "y"], "∂f/∂y");

  let resultado;
  try {
    resultado = solveODE(f, { t0, y0, h, N, ft, fy });
  } catch (error) {
    if (error instanceof OdeError) throw new Error(error.message);
    throw error;
  }

  const exactos = resultado.euler.rows.map((fila) => {
    if (!exacta) return null;
    const valor = exacta(fila.t);
    return Number.isFinite(valor) ? valor : null;
  });

  return { f, exacta, ft, fy, resultado, exactos, N, h, autoExacta };
}

function resolver() {
  limpiarAvisos();
  let datos;
  try {
    datos = leerDatos();
  } catch (error) {
    avisar(error.message);
    $("#edo-resultados").hidden = true;
    return;
  }

  state.datos = datos;
  pintarResumen(datos);
  pintarTabla(datos);
  $("#edo-exportar").disabled = false;
  $("#edo-resultados").hidden = false;
  $("#edo-grafica-card").hidden = !datos.exacta;
  $("#edo-nota-grafica").hidden = !!datos.exacta;
  if (datos.exacta) requestAnimationFrame(() => dibujarGrafica(datos));
  if (datos.autoExacta) {
    avisar(`Solución exacta detectada automáticamente: y(t) = ${datos.exacta.source}.`, "info");
  }
  $("#edo-resultados").scrollIntoView({ behavior: "smooth", block: "start" });
}

function errorDe(valor, exacto) {
  return exacto === null ? null : Math.abs(valor - exacto);
}

function pintarResumen(datos) {
  const contenedor = $("#edo-resumen");
  contenedor.innerHTML = "";
  const { resultado, exactos } = datos;
  const finalExacto = exactos[exactos.length - 1];

  for (const metodo of METODOS) {
    const r = resultado[metodo.clave];
    const error = errorDe(r.value, finalExacto);
    const card = document.createElement("article");
    card.className = "metodo-card ok";
    card.innerHTML = `
      <h3>${metodo.nombre}</h3>
      <span class="pill ok">${metodo.orden}</span>
      <p class="valor">Y<sub>N</sub> ≈ ${formatNumber(r.value, 10)}</p>
      <p class="meta">${datos.N} pasos · h = ${formatNumber(datos.h, 8)}</p>
      ${error === null ? "" : `<p class="meta">Error absoluto: ${formatNumber(error, 6)}</p>`}`;
    contenedor.append(card);
  }

  const nota = document.createElement("p");
  nota.className = "hint";
  if (finalExacto === null) {
    nota.textContent = "Escribe la solución exacta para ver el error de cada método.";
  } else {
    const errores = METODOS.map((m) => ({ nombre: m.nombre, e: errorDe(resultado[m.clave].value, finalExacto) }));
    errores.sort((a, b) => a.e - b.e);
    nota.textContent = `Error calculado en t = ${formatNumber(resultado.tEnd, 8)}. ` +
      `Menor error: ${errores[0].nombre} (${formatNumber(errores[0].e, 3)}).`;
  }
  contenedor.append(nota);
}

function pintarTabla(datos) {
  const { resultado, exactos } = datos;
  const filas = resultado.euler.rows.map((fila, i) => `
    <tr>
      <td>${fila.k}</td>
      <td>${formatNumber(fila.t, 6)}</td>
      <td>${exactos[i] === null ? "—" : formatNumber(exactos[i], 8)}</td>
      <td>${formatNumber(resultado.euler.rows[i].y, 8)}</td>
      <td>${formatNumber(resultado.eulerModified.rows[i].y, 8)}</td>
      <td>${formatNumber(resultado.taylor3.rows[i].y, 8)}</td>
      <td>${formatNumber(resultado.rk4.rows[i].y, 8)}</td>
    </tr>`).join("");

  $("#edo-tabla").innerHTML = `
    <table>
      <caption class="sr-only">Valores por paso de cada método</caption>
      <thead>
        <tr>
          <th scope="col">k</th>
          <th scope="col">t<sub>k</sub></th>
          <th scope="col">Exacta</th>
          <th scope="col">Euler</th>
          <th scope="col">E. modificado</th>
          <th scope="col">Taylor 3</th>
          <th scope="col">RK4</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
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

function dibujarGrafica(datos) {
  if (!datos.exacta) return;
  const canvas = $("#edo-grafica");
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

  const { resultado, exacta } = datos;
  const t0 = resultado.t0;
  const tEnd = resultado.tEnd;

  const valoresY = [];
  for (const m of METODOS) for (const fila of resultado[m.clave].rows) valoresY.push(fila.y);
  let exactosMuestra = [];
  if (exacta) {
    exactosMuestra = sampleFunction(exacta, t0, tEnd, 300).filter((p) => Number.isFinite(p.y));
    for (const p of exactosMuestra) valoresY.push(p.y);
  }
  const yminDatos = Math.min(...valoresY);
  const ymaxDatos = Math.max(...valoresY);
  const margenY = (ymaxDatos - yminDatos) * 0.14 || 1;

  const escalaX = escalaLimpia(t0, tEnd, 5);
  const escalaY = escalaLimpia(yminDatos - margenY, ymaxDatos + margenY, 4);
  const margenIzq = 54;
  const margenDer = 14;
  const margenSup = 44;
  const margenInf = 30;
  const X = (v) => margenIzq + ((v - escalaX.desde) / (escalaX.hasta - escalaX.desde)) * (ancho - margenIzq - margenDer);
  const Y = (v) => margenSup + (1 - (v - escalaY.desde) / (escalaY.hasta - escalaY.desde)) * (alto - margenSup - margenInf);

  contexto.clearRect(0, 0, ancho, alto);

  contexto.strokeStyle = linea;
  contexto.lineWidth = 1;
  for (const v of marcas(escalaY)) {
    contexto.beginPath();
    contexto.moveTo(margenIzq, Y(v));
    contexto.lineTo(ancho - margenDer, Y(v));
    contexto.stroke();
  }
  for (const v of marcas(escalaX)) {
    contexto.beginPath();
    contexto.moveTo(X(v), margenSup);
    contexto.lineTo(X(v), alto - margenInf);
    contexto.stroke();
  }

  const colores = {
    euler: tenue,
    eulerModified: acento,
    taylor3: naranja,
    rk4: verde,
  };

  // Solución exacta
  if (exactosMuestra.length) {
    contexto.save();
    contexto.setLineDash([5, 4]);
    contexto.strokeStyle = tinta;
    contexto.lineWidth = 1.6;
    contexto.beginPath();
    exactosMuestra.forEach((p, i) => {
      if (i === 0) contexto.moveTo(X(p.t), Y(p.y));
      else contexto.lineTo(X(p.t), Y(p.y));
    });
    contexto.stroke();
    contexto.restore();
  }

  // Curvas numéricas
  for (const metodo of METODOS) {
    contexto.strokeStyle = colores[metodo.clave];
    contexto.lineWidth = metodo.clave === "rk4" ? 2.6 : 2.1;
    contexto.beginPath();
    resultado[metodo.clave].rows.forEach((fila, i) => {
      if (i === 0) contexto.moveTo(X(fila.t), Y(fila.y));
      else contexto.lineTo(X(fila.t), Y(fila.y));
    });
    contexto.stroke();
  }

  // Nodos de RK4
  contexto.fillStyle = verde;
  for (const fila of resultado.rk4.rows) {
    contexto.beginPath();
    contexto.arc(X(fila.t), Y(fila.y), 3.2, 0, Math.PI * 2);
    contexto.fill();
  }

  // Etiquetas
  contexto.fillStyle = tenue;
  contexto.font = "11px system-ui, sans-serif";
  contexto.textAlign = "center";
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

  // Leyenda en dos filas
  contexto.textAlign = "left";
  contexto.textBaseline = "middle";
  contexto.font = "10.5px system-ui, sans-serif";
  const leyenda = [
    ["Euler", tenue, false],
    ["E. mod.", acento, false],
    ["Taylor", naranja, false],
    ["RK4", verde, false],
    ["Exacta", tinta, true],
  ];
  let lx = margenIzq;
  let ly = 14;
  for (const [texto, c, discontinuo] of leyenda) {
    if (lx > ancho - 80) { lx = margenIzq; ly += 17; }
    contexto.strokeStyle = c;
    contexto.lineWidth = 2.3;
    contexto.save();
    if (discontinuo) contexto.setLineDash([4, 3]);
    contexto.beginPath();
    contexto.moveTo(lx, ly);
    contexto.lineTo(lx + 16, ly);
    contexto.stroke();
    contexto.restore();
    contexto.fillStyle = tenue;
    contexto.fillText(texto, lx + 20, ly);
    lx += 21 + contexto.measureText(texto).width + 10;
  }
}

/* -------------------------------------------------------------------- CSV */

function exportarCSV() {
  const datos = state.datos;
  if (!datos) return;
  const { resultado, exactos } = datos;
  const lineas = ["k;t;exacta;euler;euler_modificado;taylor3;rk4"];

  resultado.euler.rows.forEach((fila, i) => {
    lineas.push([
      fila.k,
      fila.t,
      exactos[i] ?? "",
      resultado.euler.rows[i].y,
      resultado.eulerModified.rows[i].y,
      resultado.taylor3.rows[i].y,
      resultado.rk4.rows[i].y,
    ].join(";"));
  });

  const contenido = "\ufeff" + lineas.join("\n");
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "edo.csv";
  enlace.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------ ejemplos/URL */

function aplicarEjemplo(clave) {
  const e = EJEMPLOS[clave];
  if (!e) return;
  $("#edo-funcion").value = e.f;
  $("#edo-t0").value = e.t0;
  $("#edo-y0").value = e.y0;
  $("#edo-h").value = e.h;
  $("#edo-n").value = e.N;
  $("#edo-exacta").value = e.exacta;
  $("#edo-ft").value = e.ft;
  $("#edo-fy").value = e.fy;
  limpiarAvisos();
}

function leerParametros() {
  const params = new URLSearchParams(location.search);
  if (!params.has("edo")) return { run: false };
  $("#edo-funcion").value = params.get("edo");
  if (params.has("t0")) $("#edo-t0").value = params.get("t0");
  if (params.has("y0")) $("#edo-y0").value = params.get("y0");
  if (params.has("h")) $("#edo-h").value = params.get("h");
  if (params.has("N")) $("#edo-n").value = params.get("N");
  // Si la URL trae otra f(t,y), no conservar la solución exacta del ejemplo
  // anterior: se deja vacía para que el resolvedor automático intente.
  $("#edo-exacta").value = params.has("exacta") ? params.get("exacta") : "";
  $("#edo-ft").value = params.has("ft") ? params.get("ft") : "";
  $("#edo-fy").value = params.has("fy") ? params.get("fy") : "";
  return { run: params.get("run") === "1" };
}

function calcularExacta() {
  limpiarAvisos();
  try {
    const t0 = num($("#edo-t0").value);
    const y0 = num($("#edo-y0").value);
    if (!Number.isFinite(t0) || !Number.isFinite(y0)) {
      throw new Error("t₀ y y₀ deben ser números.");
    }
    const expresion = solveExact($("#edo-funcion").value, t0, y0);
    if (!expresion) {
      const lineal = isLinearODE($("#edo-funcion").value);
      avisar(lineal
        ? "La ecuación es lineal, pero la primitiva necesaria no es elemental o no está " +
          "en las formas automáticas. Escribe la solución exacta manualmente."
        : "No se reconoce una solución analítica automática para esta f(t,y). " +
          "Escríbela manualmente o usa los métodos numéricos.");
      return;
    }
    $("#edo-exacta").value = expresion;
    avisar(`Solución exacta: y(t) = ${expresion}. Pulsa Resolver EDO para graficar.`, "info");
  } catch (error) {
    avisar(error.message);
  }
}

export function initEdos() {
  $$(".chip[data-edo-ejemplo]").forEach((boton) => {
    boton.addEventListener("click", () => aplicarEjemplo(boton.dataset.edoEjemplo));
  });
  // Al cambiar f, t0 o y0, una solución exacta anterior puede dejar de ser
  // válida; se limpia para no mostrar una comparación equivocada.
  for (const id of ["edo-funcion", "edo-t0", "edo-y0"]) {
    $(`#${id}`).addEventListener("input", () => {
      $("#edo-exacta").value = "";
    });
  }
  $("#edo-resolver").addEventListener("click", resolver);
  $("#edo-exacta-btn").addEventListener("click", calcularExacta);
  $("#edo-exportar").addEventListener("click", exportarCSV);
  document.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter" || !evento.target.matches("input")) return;
    if (!evento.target.closest("#vista-edo")) return;
    evento.preventDefault();
    resolver();
  });

  let temporizador;
  window.addEventListener("resize", () => {
    if ($("#edo-resultados").hidden) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      if (state.datos?.exacta) dibujarGrafica(state.datos);
    }, 150);
  });

  const parametros = leerParametros();
  if (parametros.run) resolver();

  return {
    redibujar() {
      if (!$("#edo-resultados").hidden && state.datos) dibujarGrafica(state.datos);
    },
  };
}
