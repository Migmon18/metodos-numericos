/**
 * sistemas.js — Módulo «Sistemas lineales».
 * Interfaz de los métodos iterativos de Jacobi y Gauss-Seidel.
 */
import {
  parseLinearSystem, parseVector, validateSystem,
  analyzeDiagonalDominance, findEDDOrder, applyRowOrder,
  jacobi, gaussSeidel, iterationSystem, spectralRadius,
  NORMAS, CRITERIOS,
} from "./linear.js";
import { formatNumber } from "./core.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const METODOS = {
  jacobi: { nombre: "Jacobi", corto: "Jacobi" },
  gaussSeidel: { nombre: "Gauss-Seidel", corto: "Gauss-Seidel" },
};

const EJEMPLOS = {
  tridiagonal: {
    A: "4 -1 0 0\n-1 4 -1 0\n0 -1 4 -1\n0 0 -1 4",
    b: "1 1 1 1",
    x0: "0 0 0 0",
    tol: "0.1",
  },
  orden3: {
    A: "10 -1 2\n-1 11 -1\n2 -1 10",
    b: "6 22 -10",
    x0: "0 0 0",
    tol: "0.01",
  },
  noedd: {
    A: "2 1 0\n1 2 1\n0 1 2",
    b: "3 4 3",
    x0: "0 0 0",
    tol: "1e-8",
  },
  reordenar: {
    A: "2 -6 -1\n-3 -1 7\n-8 1 -2",
    b: "6 12 -13",
    x0: "0 0 0",
    tol: "1e-2",
  },
  g4: {
    A: "6 -1 1\n-1 7 -2\n2 -1 8",
    b: "6 4 9",
    x0: "0 0 0",
    tol: "1e-6",
  },
};

const state = {
  datos: null,
  resultados: [],
  activo: null,
};

/* ------------------------------------------------------------- utilidades */

function num(texto) {
  if (texto === null || texto === undefined) return NaN;
  const limpio = String(texto).trim().replace(/\s/g, "").replace(",", ".");
  if (limpio === "") return NaN;
  return Number(limpio);
}

function contarValores(texto) {
  return String(texto ?? "").trim().split(/[\s,]+/).filter(Boolean).length;
}

function ceros(n) {
  return new Array(n).fill(0).join(" ");
}

function dimensionDeMatriz() {
  try {
    return parseLinearSystem($("#sis-matriz").value).A.length;
  } catch {
    return null;
  }
}

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (texto) => String(texto).replace(/[&<>"']/g, (c) => ESCAPES[c]);

function avisar(texto, tipo = "error") {
  const caja = $("#sis-mensajes");
  caja.textContent = texto;
  caja.className = `mensajes ${tipo === "info" ? "info" : ""}`;
}

function limpiarAvisos() {
  const caja = $("#sis-mensajes");
  caja.textContent = "";
  caja.className = "mensajes";
}

function atajoEnter(evento) {
  if (evento.key !== "Enter" || !evento.target.matches("input")) return;
  if (!evento.target.closest("#vista-sistemas")) return;
  evento.preventDefault();
  resolver();
}

/* ---------------------------------------------------------------- lectura */

function leerDatos() {
  const { A, b: bAumentada, aumentada } = parseLinearSystem($("#sis-matriz").value);
  const b = bAumentada ?? parseVector($("#sis-b").value, A.length, { nombre: "el vector b" });
  const x0 = parseVector($("#sis-x0").value, A.length, {
    nombre: "el vector inicial X⁽⁰⁾",
    ceroPorDefecto: true,
  });

  const tol = num($("#sis-tol").value);
  const maxIter = Math.trunc(num($("#sis-maxiter").value));
  const criterio = $("#sis-criterio").value;
  const norma = $("#sis-norma").value;
  const metodos = $$('input[name="metodo-sis"]:checked').map((i) => i.value);

  if (metodos.length === 0) throw new Error("Selecciona al menos un método.");
  if (!Number.isFinite(tol) || tol <= 0) throw new Error("La tolerancia debe ser un número mayor que cero.");
  if (!Number.isFinite(maxIter) || maxIter < 1) throw new Error("El número de iteraciones debe ser al menos 1.");
  if (maxIter > 500) throw new Error("El número de iteraciones no puede superar 500.");
  if (!(criterio in CRITERIOS)) throw new Error("Elige un criterio de detención válido.");
  if (!(norma in NORMAS)) throw new Error("Elige una norma válida.");

  validateSystem(A, b);

  return { A, b, x0, tol, maxIter, criterio, norma, metodos, aumentada };
}

/* -------------------------------------------------------------- resolución */

function resolver() {
  limpiarAvisos();
  let datos;

  try {
    datos = leerDatos();
  } catch (error) {
    avisar(error.message);
    $("#sis-resultados").hidden = true;
    return;
  }

  const boton = $("#sis-resolver");
  boton.disabled = true;

  try {
    const resultados = datos.metodos.map((clave) => {
      const base = { clave, nombre: METODOS[clave].nombre };
      try {
        const metodo = clave === "jacobi" ? jacobi : gaussSeidel;
        const resultado = metodo(datos.A, datos.b, {
          x0: datos.x0,
          tol: datos.tol,
          maxIter: datos.maxIter,
          criterio: datos.criterio,
          norma: datos.norma,
        });

        let B = null;
        let c = null;
        let rho = null;
        try {
          ({ B, c } = iterationSystem(datos.A, datos.b, clave));
          rho = spectralRadius(B);
        } catch {
          // El diagnóstico de matrices es opcional: no debe ocultar el resultado.
        }

        return { ...base, ...resultado, B, c, rho };
      } catch (error) {
        return { ...base, error: error.message };
      }
    });

    state.datos = datos;
    state.resultados = resultados;
    state.activo = resultados.find((r) => !r.error)?.clave ?? null;

    const fallos = resultados.filter((r) => r.error);
    if (fallos.length === resultados.length) {
      avisar(fallos.map((r) => `${r.nombre}: ${r.error}`).join(" · "));
    } else if (fallos.length) {
      avisar(fallos.map((r) => `${r.nombre}: ${r.error}`).join(" · "), "info");
    }

    pintarResumen(resultados);
    pintarDiagnostico();
    pintarTabs(resultados);
    pintarTabla(state.activo);
    $("#sis-exportar").disabled = !resultados.some((r) => !r.error);
    $("#sis-resultados").hidden = false;
    requestAnimationFrame(() => {
      dibujarConvergencia();
      actualizarPistaTabla();
    });
    $("#sis-resultados").scrollIntoView({ behavior: "smooth", block: "start" });
  } finally {
    boton.disabled = false;
  }
}

/* ---------------------------------------------------------------- pintado */

function pintarResumen(resultados) {
  const contenedor = $("#sis-resumen");
  contenedor.innerHTML = "";

  for (const r of resultados) {
    const tarjeta = document.createElement("article");
    tarjeta.className = "metodo-card";

    if (r.error) {
      tarjeta.classList.add("fallo");
      tarjeta.innerHTML = `
        <h3>${esc(r.nombre)}</h3>
        <span class="pill fallo">No aplicable</span>
        <p class="meta">${esc(r.error)}</p>`;
    } else {
      const estado = r.converged ? "Convergió" : r.diverged ? "Divergió" : "Sin converger";
      const solucion = r.diverged
        ? "La sucesión no converge"
        : `X ≈ (${r.solution.map((v) => formatNumber(v, 8)).join(", ")})`;
      tarjeta.classList.add(r.converged ? "ok" : "fallo");
      tarjeta.innerHTML = `
        <h3>${esc(r.nombre)}</h3>
        <span class="pill ${r.converged ? "ok" : "fallo"}">${estado}</span>
        <p class="solucion">${solucion}</p>
        <p class="meta">${r.count} ${r.count === 1 ? "iteración" : "iteraciones"} · ${esc(r.reason)}</p>
        <p class="meta">
          ‖ΔX‖<sub>${NORMAS[r.norma].etiqueta}</sub> = ${formatNumber(r.finalStep, 6)} ·
          ‖R‖<sub>${NORMAS[r.norma].etiqueta}</sub> = ${formatNumber(r.finalResidual, 6)}
        </p>`;
    }

    contenedor.append(tarjeta);
  }
}

function tablaMatriz(B) {
  const filas = B.map((fila) => `<tr>${fila.map((v) => `<td>${formatNumber(v, 4)}</td>`).join("")}</tr>`);
  return `<table class="matriz" aria-label="matriz">${filas.join("")}</table>`;
}

function tablaVector(v) {
  return `<table class="matriz" aria-label="vector">${v
    .map((valor) => `<tr><td>${formatNumber(valor, 4)}</td></tr>`)
    .join("")}</table>`;
}

function bloqueMatriz(r) {
  const jacobi = r.clave === "jacobi";
  const matriz = jacobi ? "B<sub>J</sub>" : "B<sub>GS</sub>";
  const formula = jacobi
    ? "B<sub>J</sub> = −D<sup>−1</sup>(L+U), c = D<sup>−1</sup>b"
    : "B<sub>GS</sub> = −(D+L)<sup>−1</sup>U, c = (D+L)<sup>−1</sup>b";

  let juicio = "No se pudo estimar ρ(B).";
  let clase = "fallo";
  if (Number.isFinite(r.rho)) {
    juicio = "ρ ≈ 1: la convergencia no puede garantizarse.";
    if (r.rho < 1 - 1e-9) {
      juicio = "ρ < 1: el esquema converge para toda X⁽⁰⁾.";
      clase = "ok";
    } else if (r.rho > 1 + 1e-9) {
      juicio = "ρ > 1: el esquema diverge para alguna X⁽⁰⁾.";
      clase = "fallo";
    }
  }

  return `
    <div class="bloque-matriz">
      <h4>${esc(r.nombre)}</h4>
      <p class="formula"><code>${formula}</code></p>
      <div class="fila-matriz">
        <span class="etiqueta-matriz">${matriz} =</span>${tablaMatriz(r.B)}
        <span class="etiqueta-matriz">c =</span>${tablaVector(r.c)}
      </div>
      <p class="rho">
        <strong>ρ(${jacobi ? "B<sub>J</sub>" : "B<sub>GS</sub>"}) ≈ ${formatNumber(r.rho, 5)}</strong>
        <span class="pill ${clase}">${juicio}</span>
      </p>
    </div>`;
}

function pintarDiagnostico() {
  const contenedor = $("#sis-diagnostico");
  const { A, b, aumentada } = state.datos;
  const analisis = analyzeDiagonalDominance(A);
  const orden = analisis.ok ? A.map((_, i) => i) : findEDDOrder(A);

  const filas = analisis.filas
    .map((fila) => `
      <tr>
        <td>${fila.i + 1}</td>
        <td>${formatNumber(Math.abs(fila.diagonal), 6)}</td>
        <td>${formatNumber(fila.suma, 6)}</td>
        <td class="${fila.ok ? "si" : "no"}">${fila.ok ? "Sí" : "No"}</td>
      </tr>`)
    .join("");

  const avisos = [];

  if (aumentada) {
    avisos.push(`<p class="aviso-sistema info">Se usó la forma aumentada: el vector b se tomó de la última columna.</p>`);
  }

  if (analisis.diagonalNula.length) {
    avisos.push(`
      <p class="aviso-sistema">
        Hay ceros en la diagonal (${analisis.diagonalNula.map((i) => `a<sub>${i + 1}${i + 1}</sub>`).join(", ")}).
        Jacobi y Gauss-Seidel no pueden despejar esas incógnitas sin reordenar las ecuaciones.
      </p>`);
  }

  if (analisis.ok) {
    avisos.push(`
      <p class="aviso-sistema info">
        La matriz es <strong>estrictamente dominante por filas</strong>: ambos métodos convergen
        para cualquier vector inicial X⁽⁰⁾.
      </p>`);
  } else if (orden && orden.some((valor, i) => valor !== i)) {
    avisos.push(`
      <p class="aviso-sistema">
        No es E.D.D. en el orden actual, pero sí lo es si se reordenan las ecuaciones en el orden
        <strong>${orden.map((i) => i + 1).join(", ")}</strong>. Permutar filas no cambia la solución.
      </p>
      <div class="acciones-inline">
        <button type="button" class="secondary" id="sis-reordenar" data-orden="${orden.join(",")}">
          Reordenar ecuaciones
        </button>
      </div>`);
  } else {
    avisos.push(`
      <p class="aviso-sistema">
        No es E.D.D. y no se puede conseguir solo permutando filas. Los métodos pueden converger
        igualmente: revisa el radio espectral ρ(B) en «Matrices de iteración».
      </p>`);
  }

  const validos = state.resultados.filter((r) => !r.error && r.B);
  const matrices = validos.length
    ? `<details class="matrices">
         <summary>Matrices de iteración y radio espectral</summary>
         <div class="bloques-matrices">${validos.map(bloqueMatriz).join("")}</div>
       </details>`
    : "";

  contenedor.innerHTML = `
    <div class="diagnostico">
      <div class="diagnostico-cabecera">
        <span class="badge ${analisis.ok ? "ok" : "no"}">${analisis.ok ? "E.D.D." : "No E.D.D."}</span>
        <p>Sistema de ${A.length} × ${A.length} con b = (${b.map((v) => formatNumber(v, 6)).join(", ")})^T.</p>
      </div>
      <div class="tabla-wrap">
        <table class="tabla-diagnostico">
          <caption class="sr-only">Dominancia diagonal por fila</caption>
          <thead>
            <tr>
              <th scope="col">Fila</th>
              <th scope="col">|a<sub>ii</sub>|</th>
              <th scope="col">Σ |a<sub>ij</sub>|, j ≠ i</th>
              <th scope="col">¿E.D.D.?</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      ${avisos.join("")}
      ${matrices}
    </div>`;

  const boton = $("#sis-reordenar", contenedor);
  if (boton) {
    boton.addEventListener("click", () => {
      const permiso = boton.dataset.orden.split(",").map(Number);
      const reordenado = applyRowOrder(state.datos.A, state.datos.b, permiso);
      $("#sis-matriz").value = reordenado.A.map((fila) => fila.join(" ")).join("\n");
      $("#sis-b").value = reordenado.b.join(" ");
      limpiarAvisos();
      resolver();
    });
  }
}

function pintarTabs(resultados) {
  const tabs = $("#sis-tabs");
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
  const contenedor = $("#sis-tabla-detalle");
  const nota = $("#sis-nota-detalle");
  const r = state.resultados.find((x) => x.clave === clave);

  if (!state.resultados.some((x) => !x.error)) {
    contenedor.innerHTML = `<p class="hint">Ningún método pudo aplicarse con estos datos. Revisa la matriz, el vector b y la diagonal.</p>`;
    nota.textContent = "";
    return;
  }

  if (!r || r.error) {
    contenedor.innerHTML = `<p class="hint">${esc(r?.error ?? "Sin iteraciones que mostrar.")}</p>`;
    nota.textContent = "";
    return;
  }

  const columnas = [
    { campo: "k", titulo: "k", valor: (it) => it.k },
    ...r.solution.map((_, i) => ({
      campo: `x${i + 1}`,
      titulo: `x${i + 1}`,
      valor: (it) => it.x[i],
    })),
    { campo: "step", titulo: "‖ΔX‖", valor: (it) => it.step },
    { campo: "residual", titulo: "‖R‖", valor: (it) => it.residual },
    { campo: "relative", titulo: "rel.", valor: (it) => it.relative },
  ];

  const filas = r.iterations.map((it, indice) => {
    const ultima = indice === r.iterations.length - 1;
    const celdas = columnas
      .map(({ campo, valor }) => `<td data-campo="${campo}">${formatNumber(valor(it), 6)}</td>`)
      .join("");
    return `<tr class="${ultima ? "final" : ""}">${celdas}</tr>`;
  });

  contenedor.innerHTML = `
    <table>
      <caption class="sr-only">Iteraciones del método ${esc(r.nombre)}</caption>
      <thead>
        <tr>${columnas
          .map((c) => `<th scope="col" data-campo="${c.campo}">${c.titulo}</th>`)
          .join("")}</tr>
      </thead>
      <tbody>${filas.join("")}</tbody>
    </table>`;

  nota.textContent =
    `${r.nombre}: ${r.count} iteraciones. ${r.reason}. ` +
    `Criterio: ${CRITERIOS[r.criterio].etiqueta.toLowerCase()}; norma ${NORMAS[r.norma].etiqueta}.`;
  requestAnimationFrame(actualizarPistaTabla);
}

function actualizarPistaTabla() {
  const contenedor = $("#sis-tabla-detalle");
  const quedanColumnas = contenedor.scrollLeft + contenedor.clientWidth < contenedor.scrollWidth - 4;
  contenedor.classList.toggle("desborda", quedanColumnas);
}

/* ---------------------------------------------------------------- gráfica */

const SUPERINDICES = {
  0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴",
  5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹",
  "-": "⁻",
};

function potencia10(exponente) {
  return "10" + String(exponente).split("").map((c) => SUPERINDICES[c] ?? c).join("");
}

function dibujarConvergencia() {
  const canvas = $("#sis-grafica");
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
  const exito = color("--ok");

  const validos = state.resultados.filter((r) => !r.error && r.iterations.length);
  if (!validos.length) {
    contexto.clearRect(0, 0, ancho, alto);
    return;
  }

  const series = validos.map((r) => ({
    nombre: r.nombre,
    color: r.clave === "jacobi" ? acento : exito,
    puntos: r.iterations
      .map((it) => ({
        k: it.k,
        y: Number.isFinite(it.residual)
          ? Math.log10(Math.max(it.residual, 1e-16))
          : Math.log10(1e308),
      }))
      .filter((p) => Number.isFinite(p.y)),
  })).filter((s) => s.puntos.length);

  if (!series.length) {
    contexto.clearRect(0, 0, ancho, alto);
    return;
  }

  const todos = series.flatMap((s) => s.puntos);
  const maxK = Math.max(...todos.map((p) => p.k), 1);
  let ymin = Math.min(...todos.map((p) => p.y));
  let ymax = Math.max(...todos.map((p) => p.y));
  if (ymin === ymax) { ymin -= 1; ymax += 1; }
  const desde = Math.floor(ymin);
  const hasta = Math.ceil(ymax);

  const margenIzq = 52;
  const margenDer = 14;
  const margenSup = 30;
  const margenInf = 28;
  const X = (k) => margenIzq + (k / maxK) * (ancho - margenIzq - margenDer);
  const Y = (v) => margenSup + (1 - (v - desde) / (hasta - desde)) * (alto - margenSup - margenInf);

  contexto.clearRect(0, 0, ancho, alto);

  // Rejilla horizontal en potencias de diez
  contexto.strokeStyle = linea;
  contexto.lineWidth = 1;
  const pasoE = Math.max(1, Math.ceil((hasta - desde) / 6));
  contexto.fillStyle = tenue;
  contexto.font = "11px system-ui, sans-serif";
  contexto.textAlign = "right";
  contexto.textBaseline = "middle";
  for (let e = desde; e <= hasta; e += pasoE) {
    const y = Y(e);
    contexto.beginPath();
    contexto.moveTo(margenIzq, y);
    contexto.lineTo(ancho - margenDer, y);
    contexto.stroke();
    contexto.fillText(potencia10(e), margenIzq - 7, y);
  }

  // Rejilla vertical y etiquetas de k
  contexto.textAlign = "center";
  contexto.textBaseline = "top";
  const pasoK = Math.max(1, Math.ceil(maxK / 8));
  for (let k = 0; k <= maxK; k += pasoK) {
    const x = X(k);
    contexto.beginPath();
    contexto.moveTo(x, margenSup);
    contexto.lineTo(x, alto - margenInf);
    contexto.stroke();
    contexto.fillText(String(k), x, alto - margenInf + 6);
  }
  if (maxK % pasoK !== 0) {
    contexto.fillText(String(maxK), X(maxK), alto - margenInf + 6);
  }

  // Series
  contexto.lineWidth = 2.3;
  contexto.lineJoin = "round";
  contexto.lineCap = "round";
  for (const serie of series) {
    contexto.strokeStyle = serie.color;
    contexto.beginPath();
    serie.puntos.forEach((p, i) => {
      if (i === 0) contexto.moveTo(X(p.k), Y(p.y));
      else contexto.lineTo(X(p.k), Y(p.y));
    });
    contexto.stroke();

    const ultimo = serie.puntos[serie.puntos.length - 1];
    contexto.fillStyle = serie.color;
    contexto.beginPath();
    contexto.arc(X(ultimo.k), Y(ultimo.y), 3.5, 0, Math.PI * 2);
    contexto.fill();
  }

  // Leyenda
  contexto.textBaseline = "middle";
  contexto.font = "11px system-ui, sans-serif";
  let x = margenIzq;
  for (const serie of series) {
    contexto.strokeStyle = serie.color;
    contexto.lineWidth = 2.5;
    contexto.beginPath();
    contexto.moveTo(x, 14);
    contexto.lineTo(x + 16, 14);
    contexto.stroke();
    contexto.fillStyle = tinta;
    contexto.textAlign = "left";
    contexto.fillText(serie.nombre, x + 21, 14);
    x += 24 + contexto.measureText(serie.nombre).width + 14;
  }

}

/* -------------------------------------------------------------------- CSV */

function exportarCSV() {
  const n = state.datos?.A.length ?? 0;
  const columnas = ["metodo", "k", ...Array.from({ length: n }, (_, i) => `x${i + 1}`), "paso", "residual", "relativo"];
  const partes = [columnas.join(";")];

  for (const r of state.resultados) {
    if (r.error) continue;
    for (const it of r.iterations) {
      partes.push([
        r.nombre,
        it.k,
        ...it.x,
        it.step ?? "",
        it.residual ?? "",
        it.relative ?? "",
      ].join(";"));
    }
  }

  const contenido = "\ufeff" + partes.join("\n");
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "iteraciones-sistema.csv";
  enlace.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------ enlaces/estado */

function aplicarEjemploPorClave(clave) {
  const ejemplo = EJEMPLOS[clave];
  if (!ejemplo) return false;

  $("#sis-matriz").value = ejemplo.A;
  $("#sis-b").value = ejemplo.b;
  $("#sis-x0").value = ejemplo.x0;
  $("#sis-tol").value = ejemplo.tol;
  $("#sis-criterio").value = "paso";
  $("#sis-norma").value = "inf";
  limpiarAvisos();
  return true;
}

function aplicarEjemplo(boton) {
  aplicarEjemploPorClave(boton.dataset.sistema);
}

function leerParametros() {
  const params = new URLSearchParams(location.search);

  // Los parámetros de un enlace de raíces (b, x0, tol…) no deben tocar este
  // módulo: solo se leen si el enlace trae un sistema propio.
  if (!params.has("sistema") && !params.has("A")) return { run: false };

  if (params.get("sistema")) aplicarEjemploPorClave(params.get("sistema"));

  let n = null;
  if (params.has("A")) {
    $("#sis-matriz").value = params.get("A");
    try {
      n = parseLinearSystem(params.get("A")).A.length;
    } catch {
      n = null;
    }
  }

  if (params.has("b")) $("#sis-b").value = params.get("b");
  if (params.has("x0")) $("#sis-x0").value = params.get("x0");

  // Un enlace con solo A no puede dejar b ni X⁽⁰⁾ con la dimensión del
  // formulario por defecto (4): se completan con ceros de la dimensión de A.
  if (n !== null) {
    try {
      const parseada = parseLinearSystem($("#sis-matriz").value);
      if (parseada.aumentada && !params.has("b")) {
        $("#sis-b").value = parseada.b.join(" ");
      }
    } catch {
      // La matriz se validará al resolver.
    }
    if (!params.has("b") && contarValores($("#sis-b").value) !== n) {
      $("#sis-b").value = ceros(n);
    }
    if (!params.has("x0") && contarValores($("#sis-x0").value) !== n) {
      $("#sis-x0").value = ceros(n);
    }
  }

  if (params.has("tol")) $("#sis-tol").value = params.get("tol");
  if (params.has("crit")) $("#sis-criterio").value = params.get("crit");
  if (params.has("norma")) $("#sis-norma").value = params.get("norma");
  if (params.has("maxiter")) $("#sis-maxiter").value = params.get("maxiter");

  if (params.has("m")) {
    const pedidos = params.get("m").split(",").map((s) => s.trim());
    $$('input[name="metodo-sis"]').forEach((casilla) => {
      casilla.checked = pedidos.includes(casilla.value);
    });
  }

  return { run: params.get("run") === "1" };
}

/* ------------------------------------------------------------------ arranque */

export function initSistemas() {
  $$("#vista-sistemas .chip").forEach((boton) =>
    boton.addEventListener("click", () => aplicarEjemplo(boton)));
  $("#sis-resolver").addEventListener("click", resolver);
  $("#sis-exportar").addEventListener("click", exportarCSV);
  $("#sis-tabla-detalle").addEventListener("scroll", actualizarPistaTabla, { passive: true });
  document.addEventListener("keydown", atajoEnter);

  // Si la matriz cambia de tamaño y los vectores solo tienen ceros, se
  // ajustan para que el sistema siga siendo coherente sin tocar datos reales.
  $("#sis-matriz").addEventListener("input", () => {
    const n = dimensionDeMatriz();
    if (n === null) return;
    for (const selector of ["#sis-b", "#sis-x0"]) {
      const campo = $(selector);
      const valores = campo.value.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (valores.length !== n && valores.every((v) => v === 0)) {
        campo.value = ceros(n);
      }
    }

    try {
      const parseada = parseLinearSystem($("#sis-matriz").value);
      if (parseada.aumentada) $("#sis-b").value = parseada.b.join(" ");
    } catch {
      // Mientras se escribe, la matriz puede estar incompleta.
    }
  });

  let temporizador;
  window.addEventListener("resize", () => {
    if ($("#sis-resultados").hidden) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(dibujarConvergencia, 150);
  });

  const parametros = leerParametros();
  if (parametros.run) resolver();

  return {
    redibujar() {
      if (!$("#sis-resultados").hidden) dibujarConvergencia();
    },
  };
}
