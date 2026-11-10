/**
 * integracion.js — Módulo «Integración numérica».
 * Conecta la función y la partición con integration.js y dibuja el área.
 */
import { parseExpression, formatNumber, ParseError } from "./core.js";
import { integrate, sampleFunction, graphRange, IntegrationError } from "./integration.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const EJEMPLOS = {
  sin2: {
    f: "sin(x)^2",
    a: "0",
    b: "1.0471975512",
    N: "6",
    exacta: "0.3070924247",
  },
  exp: {
    f: "exp(-x)",
    a: "0",
    b: "1",
    N: "4",
    exacta: "0.6321205588",
  },
  racional: {
    f: "1/(1+x)",
    a: "0",
    b: "1",
    N: "6",
    exacta: "0.6931471806",
  },
};

const METODOS = [
  { clave: "trapezoid", nombre: "Trapecio", corto: "Trapecio", condicion: "Cualquier N" },
  { clave: "simpson13", nombre: "Simpson 1/3", corto: "Simpson 1/3", condicion: "N par" },
  { clave: "simpson38", nombre: "Simpson 3/8", corto: "Simpson 3/8", condicion: "N múltiplo de 3" },
];

const state = { resultado: null, datos: null };

function num(texto) {
  if (texto === null || texto === undefined) return NaN;
  const limpio = String(texto).trim().replace(/\s/g, "").replace(",", ".");
  if (limpio === "") return NaN;
  return Number(limpio);
}

function avisar(texto, tipo = "error") {
  const caja = $("#int-mensajes");
  caja.textContent = texto;
  caja.className = `mensajes ${tipo === "info" ? "info" : ""}`;
}

function limpiarAvisos() {
  const caja = $("#int-mensajes");
  caja.textContent = "";
  caja.className = "mensajes";
}

function leerDatos() {
  const expresion = $("#int-funcion").value;
  let f;
  try {
    f = parseExpression(expresion);
  } catch (error) {
    if (error instanceof ParseError) {
      throw new Error(`La función no se entiende: ${error.message}`);
    }
    throw error;
  }

  const a = num($("#int-a").value);
  const b = num($("#int-b").value);
  const N = num($("#int-n").value);
  const exactaTexto = $("#int-exacta").value.trim();
  const exacta = exactaTexto === "" ? null : num(exactaTexto);

  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error("Los extremos a y b deben ser números.");
  if (!(a < b)) throw new Error("El extremo a debe ser menor que b.");
  if (!Number.isInteger(N) || N < 1) throw new Error("N debe ser un entero al menos 1.");
  if (exactaTexto !== "" && !Number.isFinite(exacta)) {
    throw new Error("El valor exacto debe ser numérico o quedar vacío.");
  }

  let resultado;
  try {
    resultado = integrate(f, a, b, N);
  } catch (error) {
    if (error instanceof IntegrationError) throw new Error(error.message);
    throw error;
  }

  return { f, a, b, N, exacta, resultado, expresion };
}

function resolver() {
  limpiarAvisos();
  let datos;
  try {
    datos = leerDatos();
  } catch (error) {
    avisar(error.message);
    $("#int-resultados").hidden = true;
    return;
  }

  state.datos = datos;
  state.resultado = datos.resultado;
  pintarResumen(datos);
  pintarTabla(datos);
  $("#int-exportar").disabled = false;
  $("#int-resultados").hidden = false;
  requestAnimationFrame(() => dibujarGrafica(datos));
  $("#int-resultados").scrollIntoView({ behavior: "smooth", block: "start" });
}

function errorDe(valor, exacta) {
  if (exacta === null) return null;
  return Math.abs(valor - exacta);
}

function pintarResumen(datos) {
  const contenedor = $("#int-resumen");
  contenedor.innerHTML = "";
  const { resultado, exacta } = datos;

  for (const metodo of METODOS) {
    const r = resultado[metodo.clave];
    const card = document.createElement("article");
    card.className = "metodo-card";

    if (!r.applicable) {
      card.classList.add("fallo");
      card.innerHTML = `
        <h3>${metodo.nombre}</h3>
        <span class="pill fallo">No aplicable</span>
        <p class="meta">${r.reason}</p>`;
      contenedor.append(card);
      continue;
    }

    const error = errorDe(r.value, exacta);
    card.classList.add("ok");
    card.innerHTML = `
      <h3>${metodo.nombre}</h3>
      <span class="pill ok">Aplicable</span>
      <p class="valor">I ≈ ${formatNumber(r.value, 10)}</p>
      <p class="meta">N = ${r.N} · h = ${formatNumber(r.h, 8)} · ${metodo.condicion}</p>
      ${error === null ? "" : `<p class="meta">Error absoluto: ${formatNumber(error, 6)}</p>`}`;
    contenedor.append(card);
  }

  const nota = document.createElement("p");
  nota.className = "hint";
  nota.textContent = exacta === null
    ? "Ingresa un valor exacto para ver el error absoluto de cada regla."
    : `Errores calculados respecto del valor exacto ${formatNumber(exacta, 10)}.`;
  contenedor.append(nota);
}

function peso(command, k, N) {
  if (command === "trapezoid") return k === 0 || k === N ? 1 : 2;
  if (command === "simpson13") {
    if (k === 0 || k === N) return 1;
    return k % 2 === 1 ? 4 : 2;
  }
  if (command === "simpson38") {
    if (k === 0 || k === N) return 1;
    return k % 3 === 0 ? 2 : 3;
  }
  return "—";
}

function pintarTabla(datos) {
  const { resultado } = datos;
  const filas = resultado.nodes.map((nodo) => {
    const wT = peso("trapezoid", nodo.k, resultado.N);
    const w13 = resultado.simpson13.applicable ? peso("simpson13", nodo.k, resultado.N) : "—";
    const w38 = resultado.simpson38.applicable ? peso("simpson38", nodo.k, resultado.N) : "—";
    return `<tr>
      <td>${nodo.k}</td>
      <td>${formatNumber(nodo.x, 8)}</td>
      <td>${formatNumber(nodo.y, 8)}</td>
      <td>${wT}</td>
      <td>${w13}</td>
      <td>${w38}</td>
    </tr>`;
  });

  $("#int-tabla-nodos").innerHTML = `
    <table>
      <caption class="sr-only">Nodos y pesos de integración</caption>
      <thead>
        <tr>
          <th scope="col">k</th>
          <th scope="col">x<sub>k</sub></th>
          <th scope="col">f(x<sub>k</sub>)</th>
          <th scope="col">Peso T</th>
          <th scope="col">Peso S 1/3</th>
          <th scope="col">Peso S 3/8</th>
        </tr>
      </thead>
      <tbody>${filas.join("")}</tbody>
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
  const canvas = $("#int-grafica");
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

  const { f, a, b, resultado } = datos;
  const rango = graphRange(f, a, b);
  const escalaX = escalaLimpia(a, b, 5);
  const escalaY = escalaLimpia(rango.ymin, rango.ymax, 4);

  const margenIzq = 52;
  const margenDer = 14;
  const margenSup = 34;
  const margenInf = 30;
  const X = (v) => margenIzq + ((v - escalaX.desde) / (escalaX.hasta - escalaX.desde)) * (ancho - margenIzq - margenDer);
  const Y = (v) => margenSup + (1 - (v - escalaY.desde) / (escalaY.hasta - escalaY.desde)) * (alto - margenSup - margenInf);

  contexto.clearRect(0, 0, ancho, alto);

  // Rejilla
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

  // Área bajo la curva
  const muestras = sampleFunction(f, a, b, 600).filter((p) => Number.isFinite(p.y));
  contexto.save();
  contexto.beginPath();
  let primero = true;
  for (const p of muestras) {
    if (primero) {
      contexto.moveTo(X(p.x), Y(0));
      contexto.lineTo(X(p.x), Y(p.y));
      primero = false;
    } else {
      contexto.lineTo(X(p.x), Y(p.y));
    }
  }
  if (muestras.length) {
    contexto.lineTo(X(muestras[muestras.length - 1].x), Y(0));
    contexto.closePath();
    contexto.globalAlpha = 0.18;
    contexto.fillStyle = verde;
    contexto.fill();
  }
  contexto.restore();

  // Ejes cero
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
  contexto.strokeStyle = verde;
  contexto.lineWidth = 2.7;
  contexto.lineJoin = "round";
  contexto.beginPath();
  let dibujando = false;
  for (const p of muestras) {
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

  // Nodos
  if (resultado.N <= 24) {
    contexto.strokeStyle = acento;
    contexto.globalAlpha = 0.35;
    contexto.lineWidth = 1;
    for (const nodo of resultado.nodes) {
      contexto.beginPath();
      contexto.moveTo(X(nodo.x), margenSup);
      contexto.lineTo(X(nodo.x), alto - margenInf);
      contexto.stroke();
    }
    contexto.globalAlpha = 1;
  }
  for (const nodo of resultado.nodes) {
    if (resultado.N > 60) break;
    contexto.fillStyle = acento;
    contexto.beginPath();
    contexto.arc(X(nodo.x), Y(nodo.y), 3.4, 0, Math.PI * 2);
    contexto.fill();
  }

  // Etiquetas a y b
  contexto.fillStyle = tinta;
  contexto.font = "11px system-ui, sans-serif";
  contexto.textAlign = "left";
  contexto.textBaseline = "top";
  contexto.fillText("a", X(a) - 2, alto - margenInf + 6);
  contexto.textAlign = "right";
  contexto.fillText("b", X(b) + 2, alto - margenInf + 6);

  contexto.fillStyle = tenue;
  contexto.textAlign = "center";
  contexto.textBaseline = "top";
  const textosX = marcas(escalaX);
  for (let i = 0; i < textosX.length; i++) {
    const v = textosX[i];
    if (Math.abs(v - a) < 1e-12 || Math.abs(v - b) < 1e-12) continue;
    contexto.fillText(formatNumber(v, 3), X(v), alto - margenInf + 6);
  }
  contexto.textAlign = "right";
  contexto.textBaseline = "middle";
  for (const v of marcas(escalaY)) {
    contexto.fillText(formatNumber(v, 3), margenIzq - 7, Y(v));
  }

  // Leyenda
  contexto.textBaseline = "middle";
  contexto.textAlign = "left";
  contexto.font = "11px system-ui, sans-serif";
  const ly = 15;
  contexto.strokeStyle = verde;
  contexto.lineWidth = 2.5;
  contexto.beginPath();
  contexto.moveTo(margenIzq, ly);
  contexto.lineTo(margenIzq + 20, ly);
  contexto.stroke();
  contexto.fillStyle = tenue;
  contexto.fillText("f(x)", margenIzq + 25, ly);

  contexto.fillStyle = acento;
  contexto.beginPath();
  contexto.arc(margenIzq + 75, ly, 4, 0, Math.PI * 2);
  contexto.fill();
  contexto.fillStyle = tenue;
  contexto.fillText(`nodos (N = ${resultado.N})`, margenIzq + 84, ly);
}

/* -------------------------------------------------------------------- CSV */

function exportarCSV() {
  const datos = state.datos;
  if (!datos) return;
  const { resultado, exacta } = datos;
  const lineas = ["# NODOS", "k;x;f;peso_t;peso_s13;peso_s38"];

  for (const nodo of resultado.nodes) {
    const w13 = resultado.simpson13.applicable ? peso("simpson13", nodo.k, resultado.N) : "";
    const w38 = resultado.simpson38.applicable ? peso("simpson38", nodo.k, resultado.N) : "";
    lineas.push(`${nodo.k};${nodo.x};${nodo.y};${peso("trapezoid", nodo.k, resultado.N)};${w13};${w38}`);
  }
  lineas.push("", "# RESULTADOS", "metodo;N;h;valor;error");
  for (const m of METODOS) {
    const r = resultado[m.clave];
    const err = r.applicable && exacta !== null ? Math.abs(r.value - exacta) : "";
    lineas.push(`${r.method};${r.N};${r.h};${r.applicable ? r.value : ""};${err}`);
  }

  const contenido = "\ufeff" + lineas.join("\n");
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "integracion.csv";
  enlace.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------ ejemplos/URL */

function aplicarEjemplo(clave) {
  const e = EJEMPLOS[clave];
  if (!e) return;
  $("#int-funcion").value = e.f;
  $("#int-a").value = e.a;
  $("#int-b").value = e.b;
  $("#int-n").value = e.N;
  $("#int-exacta").value = e.exacta;
  limpiarAvisos();
}

function leerParametros() {
  const params = new URLSearchParams(location.search);
  if (!params.has("int")) return { run: false };
  $("#int-funcion").value = params.get("int");
  if (params.has("a")) $("#int-a").value = params.get("a");
  if (params.has("b")) $("#int-b").value = params.get("b");
  if (params.has("N")) $("#int-n").value = params.get("N");
  if (params.has("exacta")) $("#int-exacta").value = params.get("exacta");
  return { run: params.get("run") === "1" };
}

export function initIntegracion() {
  $$(".chip[data-int-ejemplo]").forEach((boton) => {
    boton.addEventListener("click", () => aplicarEjemplo(boton.dataset.intEjemplo));
  });
  $("#int-resolver").addEventListener("click", resolver);
  $("#int-exportar").addEventListener("click", exportarCSV);
  document.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter" || !evento.target.matches("input")) return;
    if (!evento.target.closest("#vista-integracion")) return;
    evento.preventDefault();
    resolver();
  });

  let temporizador;
  window.addEventListener("resize", () => {
    if ($("#int-resultados").hidden) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      if (state.datos) dibujarGrafica(state.datos);
    }, 150);
  });

  const parametros = leerParametros();
  if (parametros.run) resolver();

  return {
    redibujar() {
      if (!$("#int-resultados").hidden && state.datos) dibujarGrafica(state.datos);
    },
  };
}
