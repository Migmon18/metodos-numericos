/**
 * raices.js — Módulo «Raíces de ecuaciones».
 * Conecta el formulario con core.js, pinta resultados, tabla, gráfica y CSV.
 */
import {
  parseExpression, bisection, regulaFalsi, newton,
  sample, formatNumber, ParseError,
} from "./core.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const METODOS = {
  biseccion: { nombre: "Bisección", corto: "Bisección" },
  regula: { nombre: "Regula falsi", corto: "Regula falsi" },
  newton: { nombre: "Newton-Raphson", corto: "Newton" },
};

const state = {
  f: null,
  resultados: [],
  activo: null,
};

/* ------------------------------------------------------------- utilidades */

/** Acepta coma decimal y devuelve un número, o NaN. */
function num(texto) {
  if (texto === null || texto === undefined) return NaN;
  const limpio = String(texto).trim().replace(/\s/g, "").replace(",", ".");
  if (limpio === "") return NaN;
  return Number(limpio);
}

function avisar(texto, tipo = "error") {
  const caja = $("#mensajes");
  caja.textContent = texto;
  caja.className = `mensajes ${tipo === "info" ? "info" : ""}`;
}

function limpiarAvisos() {
  const caja = $("#mensajes");
  caja.textContent = "";
  caja.className = "mensajes";
}

/** Atajo de teclado: Enter en un campo de este módulo lanza el cálculo. */
function atajoEnter(evento) {
  if (evento.key !== "Enter" || !evento.target.matches("input")) return;
  if (!evento.target.closest("#vista-raices")) return;
  evento.preventDefault();
  resolver();
}

/* ---------------------------------------------------------------- lectura */

function leerDatos() {
  const expresion = $("#funcion").value;
  const metodos = $$('input[name="metodo"]:checked').map((i) => i.value);

  if (metodos.length === 0) throw new Error("Selecciona al menos un método.");

  let f;
  try {
    f = parseExpression(expresion);
  } catch (error) {
    if (error instanceof ParseError) {
      throw new Error(`La función no se entiende: ${error.message}`);
    }
    throw error;
  }

  const a = num($("#a").value);
  const b = num($("#b").value);
  const x0 = num($("#x0").value);
  const tol = num($("#tol").value);
  const maxIter = Math.trunc(num($("#maxiter").value));

  if (!Number.isFinite(tol) || tol <= 0) throw new Error("La tolerancia debe ser un número mayor que cero.");
  if (!Number.isFinite(maxIter) || maxIter < 1) throw new Error("El número de iteraciones debe ser al menos 1.");
  if (maxIter > 500) throw new Error("El número de iteraciones no puede superar 500.");

  const necesitaIntervalo = metodos.some((m) => m !== "newton");
  if (necesitaIntervalo) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      throw new Error("Bisección y regula falsi necesitan dos extremos numéricos (a y b).");
    }
    if (a === b) throw new Error("Los extremos a y b deben ser distintos.");
  }
  if (metodos.includes("newton") && !Number.isFinite(x0)) {
    throw new Error("Newton-Raphson necesita un valor inicial x₀ numérico.");
  }

  let derivada = null;
  const textoDerivada = $("#derivada").value.trim();
  if (textoDerivada) {
    try {
      derivada = parseExpression(textoDerivada);
    } catch (error) {
      throw new Error(`La derivada no se entiende: ${error.message}`);
    }
  }

  return { f, a, b, x0, tol, maxIter, metodos, derivada, expresion };
}

/* -------------------------------------------------------------- resolución */

function resolver() {
  limpiarAvisos();
  let datos;

  try {
    datos = leerDatos();
  } catch (error) {
    avisar(error.message);
    $("#resultados").hidden = true;
    return;
  }

  const boton = $("#resolver");
  boton.disabled = true;

  try {
    const resultados = datos.metodos.map((clave) => {
      const base = { clave, nombre: METODOS[clave].nombre };
      try {
        if (clave === "biseccion") {
          return { ...base, ...bisection(datos.f, datos.a, datos.b, { tol: datos.tol, maxIter: datos.maxIter }) };
        }
        if (clave === "regula") {
          return { ...base, ...regulaFalsi(datos.f, datos.a, datos.b, { tol: datos.tol, maxIter: datos.maxIter }) };
        }
        return { ...base, ...newton(datos.f, datos.x0, { tol: datos.tol, maxIter: datos.maxIter, derivative: datos.derivada }) };
      } catch (error) {
        return { ...base, error: error.message };
      }
    });

    state.f = datos.f;
    state.resultados = resultados;
    state.activo = resultados.find((r) => !r.error)?.clave ?? null;

    const fallos = resultados.filter((r) => r.error);
    if (fallos.length === resultados.length) {
      avisar(fallos.map((r) => `${r.nombre}: ${r.error}`).join(" · "));
    } else if (fallos.length) {
      avisar(fallos.map((r) => `${r.nombre}: ${r.error}`).join(" · "), "info");
    }

    pintarResumen(resultados);
    pintarTabs(resultados);
    pintarTabla(state.activo);
    $("#exportar").disabled = !resultados.some((r) => !r.error);
    $("#resultados").hidden = false;
    requestAnimationFrame(() => dibujarGrafica(datos));
    $("#resultados").scrollIntoView({ behavior: "smooth", block: "start" });
  } finally {
    boton.disabled = false;
  }
}

/* ---------------------------------------------------------------- pintado */

function pintarResumen(resultados) {
  const contenedor = $("#resumen");
  contenedor.innerHTML = "";

  for (const r of resultados) {
    const tarjeta = document.createElement("article");
    tarjeta.className = "metodo-card";

    if (r.error) {
      tarjeta.classList.add("fallo");
      tarjeta.innerHTML = `
        <h3>${r.nombre}</h3>
        <span class="pill fallo">No aplicable</span>
        <p class="meta">${r.error}</p>`;
    } else {
      tarjeta.classList.add(r.converged ? "ok" : "fallo");
      tarjeta.innerHTML = `
        <h3>${r.nombre}</h3>
        <span class="pill ${r.converged ? "ok" : "fallo"}">${r.converged ? "Convergió" : "Sin converger"}</span>
        <p class="raiz">x ≈ ${formatNumber(r.root, 10)}</p>
        <p class="meta">${r.iterations.length} ${r.iterations.length === 1 ? "iteración" : "iteraciones"} · ${r.reason}</p>`;
    }

    contenedor.append(tarjeta);
  }
}

function pintarTabs(resultados) {
  const tabs = $("#tabs");
  tabs.innerHTML = "";
  const validos = resultados.filter((r) => !r.error);
  if (!validos.length) return;

  for (const r of validos) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.role = "tab";
    boton.textContent = METODOS[r.clave].corto;
    boton.setAttribute("aria-selected", String(r.clave === state.activo));
    boton.addEventListener("click", () => {
      state.activo = r.clave;
      $$("button", tabs).forEach((b) => b.setAttribute("aria-selected", String(b === boton)));
      pintarTabla(r.clave);
    });
    tabs.append(boton);
  }
}

function pintarTabla(clave) {
  const contenedor = $("#tabla-detalle");
  const nota = $("#nota-detalle");
  const r = state.resultados.find((x) => x.clave === clave);

  if (!state.resultados.some((x) => !x.error)) {
    contenedor.innerHTML = `<p class="hint">Ningún método pudo aplicarse con estos datos. Revisa la función, el intervalo y el valor inicial.</p>`;
    nota.textContent = "";
    return;
  }

  if (!r || r.error || r.iterations.length === 0) {
    contenedor.innerHTML = `<p class="hint">${r?.error ?? "Sin iteraciones que mostrar: la raíz ya era exacta en el punto de partida."}</p>`;
    nota.textContent = "";
    return;
  }

  const columnas = clave === "newton"
    ? [
        { campo: "n", titulo: "n" },
        { campo: "x", titulo: "xₙ" },
        { campo: "fx", titulo: "f(xₙ)" },
        { campo: "dfx", titulo: "f′(xₙ)" },
        { campo: "xNew", titulo: "xₙ₊₁" },
        { campo: "err", titulo: "error" },
      ]
    : [
        { campo: "n", titulo: "n" },
        { campo: "a", titulo: "a" },
        { campo: "b", titulo: "b" },
        { campo: "c", titulo: "c" },
        { campo: "fc", titulo: "f(c)" },
        { campo: "err", titulo: "error" },
      ];

  const filas = r.iterations.map((it, indice) => {
    const ultima = indice === r.iterations.length - 1;
    const celdas = columnas
      .map(({ campo }) => `<td data-campo="${campo}">${formatNumber(it[campo], 6)}</td>`)
      .join("");
    return `<tr class="${ultima ? "final" : ""}">${celdas}</tr>`;
  });

  contenedor.innerHTML = `
    <table>
      <caption class="sr-only">Iteraciones del método ${r.nombre}</caption>
      <thead><tr>${columnas
        .map((c) => `<th scope="col" data-campo="${c.campo}">${c.titulo}</th>`)
        .join("")}</tr></thead>
      <tbody>${filas.join("")}</tbody>
    </table>`;

  nota.textContent = `${r.nombre}: ${r.iterations.length} iteraciones. ${r.reason}.`;
  requestAnimationFrame(actualizarPistaTabla);
}

/** Muestra un degradado a la derecha mientras queden columnas por ver. */
function actualizarPistaTabla() {
  const contenedor = $("#tabla-detalle");
  const quedanColumnas = contenedor.scrollLeft + contenedor.clientWidth < contenedor.scrollWidth - 4;
  contenedor.classList.toggle("desborda", quedanColumnas);
}

/* ---------------------------------------------------------------- gráfica */

/** Rejilla con pasos «redondos»: 1, 2 o 5 por cada potencia de diez. */
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

function dibujarGrafica({ f, a, b, x0 }) {
  const canvas = $("#grafica");
  const contexto = canvas.getContext("2d");
  const ratio = Math.min(window.devicePixelRatio || 1, 2.5);

  const ancho = canvas.clientWidth;
  const alto = canvas.clientHeight;
  canvas.width = Math.round(ancho * ratio);
  canvas.height = Math.round(alto * ratio);
  contexto.setTransform(ratio, 0, 0, ratio, 0, 0);

  const estilo = getComputedStyle(document.documentElement);
  const color = (nombre) => estilo.getPropertyValue(nombre).trim();
  const tinta = color("--ink");
  const tenue = color("--muted");
  const linea = color("--line");
  const acento = color("--accent");
  const exito = color("--verde");

  const raices = state.resultados.filter((r) => !r.error).map((r) => r.root);
  const raiz = raices.length ? raices[0] : null;

  // Rango horizontal
  let xmin, xmax;
  if (Number.isFinite(a) && Number.isFinite(b) && a !== b) {
    xmin = Math.min(a, b);
    xmax = Math.max(a, b);
    const margen = (xmax - xmin) * 0.25 || 1;
    xmin -= margen;
    xmax += margen;
  } else if (raiz !== null) {
    xmin = raiz - 1.5;
    xmax = raiz + 1.5;
  } else {
    xmin = x0 - 2;
    xmax = x0 + 2;
  }

  const puntos = sample(f, xmin, xmax, 500).filter((p) => Number.isFinite(p.y));
  if (!puntos.length) {
    contexto.clearRect(0, 0, ancho, alto);
    return;
  }

  // Rango vertical robusto: percentiles para que un polo no aplaste la curva
  const ys = puntos.map((p) => p.y).sort((p, q) => p - q);
  const q = (f_) => ys[Math.min(ys.length - 1, Math.max(0, Math.round(f_ * (ys.length - 1))))];
  let ymin = q(0.02);
  let ymax = q(0.98);
  if (ymin === ymax) { ymin -= 1; ymax += 1; }
  const holgura = (ymax - ymin) * 0.12;
  ymin -= holgura;
  ymax += holgura;
  if (ymin > 0) ymin = 0;
  if (ymax < 0) ymax = 0;

  // Escalas con pasos legibles
  const escalaY = escalaLimpia(ymin, ymax, 4);
  const escalaX = escalaLimpia(xmin, xmax, 5);

  const margenIzq = 46;
  const margenDer = 10;
  const margenSup = 12;
  const margenInf = 26;
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
  contexto.strokeStyle = acento;
  contexto.lineWidth = 2.4;
  contexto.lineJoin = "round";
  contexto.beginPath();
  let dibujando = false;
  for (const p of puntos) {
    if (p.y < escalaY.desde - (escalaY.hasta - escalaY.desde) || p.y > escalaY.hasta + (escalaY.hasta - escalaY.desde)) {
      dibujando = false;
      continue;
    }
    const px = X(p.x);
    const py = Y(p.y);
    if (!dibujando) { contexto.moveTo(px, py); dibujando = true; }
    else contexto.lineTo(px, py);
  }
  contexto.stroke();

  // Raíz
  if (raiz !== null && raiz >= escalaX.desde && raiz <= escalaX.hasta) {
    const x = X(raiz);
    contexto.save();
    contexto.setLineDash([5, 4]);
    contexto.strokeStyle = exito;
    contexto.lineWidth = 1.8;
    contexto.beginPath();
    contexto.moveTo(x, margenSup);
    contexto.lineTo(x, alto - margenInf);
    contexto.stroke();
    contexto.restore();

    contexto.fillStyle = exito;
    contexto.beginPath();
    contexto.arc(x, Y(0), 5, 0, Math.PI * 2);
    contexto.fill();
  }

  // Etiquetas del eje x, alineadas para que no se salgan del lienzo
  contexto.fillStyle = tenue;
  contexto.font = "11px system-ui, sans-serif";
  contexto.textBaseline = "top";
  const textoX = marcas(escalaX);
  for (let i = 0; i < textoX.length; i++) {
    const v = textoX[i];
    const x = X(v);
    contexto.textAlign = i === 0 ? "left" : i === textoX.length - 1 ? "right" : "center";
    contexto.fillText(formatNumber(v, 3), x, alto - margenInf + 5);
  }

  // Etiquetas del eje y
  contexto.textAlign = "right";
  contexto.textBaseline = "middle";
  for (const v of marcas(escalaY)) {
    contexto.fillText(formatNumber(v, 3), margenIzq - 7, Y(v));
  }
}

/* -------------------------------------------------------------------- CSV */

function exportarCSV() {
  const partes = ["metodo;n;a;b;c;fc;error"];

  for (const r of state.resultados) {
    if (r.error || !r.iterations.length) continue;
    if (r.clave === "newton") {
      partes.push("# Newton-Raphson: x;fx;dfx;x_nuevo;error");
      for (const it of r.iterations) {
        partes.push([r.nombre, it.n, it.x, it.fx, it.dfx, it.xNew, it.err].join(";"));
      }
    } else {
      for (const it of r.iterations) {
        partes.push([r.nombre, it.n, it.a, it.b, it.c, it.fc, it.err].join(";"));
      }
    }
  }

  const contenido = "\ufeff" + partes.join("\n");
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "iteraciones.csv";
  enlace.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------ enlaces/estado */

function aplicarEjemplo(boton) {
  $("#funcion").value = boton.dataset.ejemplo;
  $("#a").value = boton.dataset.a;
  $("#b").value = boton.dataset.b;
  $("#x0").value = boton.dataset.x0;
  limpiarAvisos();
}

function leerParametros() {
  const params = new URLSearchParams(location.search);
  if (!params.has("f")) return false;

  $("#funcion").value = params.get("f");
  if (params.has("a")) $("#a").value = params.get("a");
  if (params.has("b")) $("#b").value = params.get("b");
  if (params.has("x0")) $("#x0").value = params.get("x0");
  if (params.has("tol")) $("#tol").value = params.get("tol");
  if (params.has("d")) $("#derivada").value = params.get("d");

  if (params.has("m")) {
    const pedidos = params.get("m").split(",").map((s) => s.trim());
    $$('input[name="metodo"]').forEach((casilla) => {
      casilla.checked = pedidos.includes(casilla.value);
    });
  }
  return params.get("run") === "1";
}

/* ------------------------------------------------------------------ arranque */

function redibujar() {
  if ($("#resultados").hidden) return;
  const datos = { f: state.f, a: num($("#a").value), b: num($("#b").value), x0: num($("#x0").value) };
  dibujarGrafica(datos);
}

export function initRaices() {
  $$("#vista-raices .chip").forEach((boton) => boton.addEventListener("click", () => aplicarEjemplo(boton)));
  $("#resolver").addEventListener("click", resolver);
  $("#exportar").addEventListener("click", exportarCSV);
  $("#tabla-detalle").addEventListener("scroll", actualizarPistaTabla, { passive: true });
  document.addEventListener("keydown", atajoEnter);

  let temporizador;
  window.addEventListener("resize", () => {
    if ($("#resultados").hidden) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(redibujar, 150);
  });

  if (leerParametros()) resolver();

  return { redibujar };
}
