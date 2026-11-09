/**
 * linear.js — Núcleo de sistemas lineales para la aplicación de métodos numéricos.
 *
 * Implementa los métodos iterativos de Jacobi y Gauss-Seidel del apunte
 * «Resolución de sistemas de ecuaciones lineales», junto con las herramientas
 * que el apunte usa para interpretarlos: normas vectoriales, residual, análisis
 * de dominancia diagonal estricta (E.D.D.), matrices de iteración y radio
 * espectral.
 *
 * Igual que core.js, este módulo no depende del DOM y se prueba con Node.
 */

export class LinearError extends Error {}

/* ------------------------------------------------------------------ lectura */

const MENOS = /[−–—]/g;

function aNumero(texto) {
  const limpio = String(texto).trim().replace(MENOS, "-");
  if (!limpio) return NaN;
  return Number(limpio);
}

function filasDeTexto(texto) {
  return String(texto ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/[\n;]/)
    .map((fila) => fila.trim())
    .filter((fila) => fila.length > 0);
}

function valoresDeFila(fila) {
  const limpia = fila
    .replace(/[[\]]/g, " ")
    .replace(/[{}]/g, " ")
    .trim();
  if (!limpia) return [];
  return limpia.split(/[\s,]+/).filter(Boolean).map(aNumero);
}

/**
 * Lee una matriz escrita por filas. Admite saltos de línea o «;» entre filas y
 * separa los valores con espacios o comas. También acepta la forma aumentada
 * «A | b», en cuyo caso devuelve el vector b leído a la derecha de la barra.
 *
 * @param {string} texto
 * @returns {{A:number[][], b:number[]|null, aumentada:boolean}}
 */
export function parseLinearSystem(texto) {
  const filas = filasDeTexto(texto);
  if (!filas.length) throw new LinearError("Escribe la matriz A, una fila por línea.");

  const aumentada = filas.some((fila) => fila.includes("|"));
  const A = [];
  const b = [];

  for (const [indice, fila] of filas.entries()) {
    let izquierda = fila;
    let derecha = null;

    if (aumentada) {
      const partes = fila.split("|");
      if (partes.length !== 2) {
        throw new LinearError(
          `La fila ${indice + 1} debe tener exactamente una barra «|» si usas la forma aumentada.`,
        );
      }
      izquierda = partes[0];
      derecha = partes[1];
    }

    const valores = valoresDeFila(izquierda);
    if (!valores.length) throw new LinearError(`La fila ${indice + 1} de A está vacía.`);
    if (valores.some((v) => !Number.isFinite(v))) {
      throw new LinearError(`Hay un valor no numérico en la fila ${indice + 1} de A.`);
    }
    A.push(valores);

    if (aumentada) {
      const rhs = valoresDeFila(derecha);
      if (rhs.length !== 1 || !Number.isFinite(rhs[0])) {
        throw new LinearError(`La fila ${indice + 1} debe tener un único valor de b a la derecha de «|».`);
      }
      b.push(rhs[0]);
    }
  }

  validarMatrizCuadrada(A);

  if (!aumentada) return { A, b: null, aumentada: false };

  if (b.length !== A.length) {
    throw new LinearError("La forma aumentada necesita un valor de b en cada fila.");
  }
  return { A, b, aumentada: true };
}

/**
 * Lee un vector escrito en una sola línea: «1 2 3» o «1, 2, 3».
 * Si el texto está vacío y se permite, devuelve ceros.
 */
export function parseVector(texto, n, { nombre = "el vector", ceroPorDefecto = false } = {}) {
  const limpio = String(texto ?? "").replace(/[[\]]/g, " ").trim();

  if (!limpio) {
    if (ceroPorDefecto) return new Array(n).fill(0);
    throw new LinearError(`Escribe ${nombre}.`);
  }

  const valores = limpio
    .replace(/[{}]/g, " ")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(aNumero);

  if (valores.some((v) => !Number.isFinite(v))) {
    throw new LinearError(`Hay un valor no numérico en ${nombre}.`);
  }
  if (valores.length !== n) {
    throw new LinearError(`${nombre} debe tener ${n} componente${n === 1 ? "" : "s"}; tiene ${valores.length}.`);
  }
  return valores;
}

function validarMatrizCuadrada(A) {
  if (!A.length) throw new LinearError("La matriz A está vacía.");
  const n = A.length;
  for (const [i, fila] of A.entries()) {
    if (fila.length !== n) {
      throw new LinearError(
        `La matriz A debe ser cuadrada: la fila ${i + 1} tiene ${fila.length} valores y hay ${n} filas.`,
      );
    }
  }
}

/** Comprueba dimensiones y valores finitos de un sistema A·x = b. */
export function validateSystem(A, b) {
  validarMatrizCuadrada(A);
  const n = A.length;

  if (!Array.isArray(b) || b.length !== n) {
    throw new LinearError(`El vector b debe tener ${n} componente${n === 1 ? "" : "s"}.`);
  }
  for (const [i, fila] of A.entries()) {
    for (const [j, valor] of fila.entries()) {
      if (!Number.isFinite(valor)) {
        throw new LinearError(`El elemento a${sub(i + 1)}${sub(j + 1)} no es un número finito.`);
      }
    }
  }
  if (b.some((valor) => !Number.isFinite(valor))) {
    throw new LinearError("El vector b contiene un valor no finito.");
  }
  return { n };
}

function sub(numero) {
  const mapa = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };
  return String(numero).split("").map((c) => mapa[c] ?? c).join("");
}

/* -------------------------------------------------------------- operaciones */

export function zeros(n, m = n) {
  return Array.from({ length: n }, () => new Array(m).fill(0));
}

export function cloneVector(v) {
  return [...v];
}

export function matrixVector(A, x) {
  return A.map((fila) => fila.reduce((suma, valor, j) => suma + valor * x[j], 0));
}

export function residualVector(A, x, b) {
  return matrixVector(A, x).map((valor, i) => valor - b[i]);
}

/** Norma vectorial: «inf» (máximo), «1» (suma) o «2» (euclidiana). */
export function vectorNorm(v, tipo = "inf") {
  if (tipo === "1") return v.reduce((suma, valor) => suma + Math.abs(valor), 0);
  if (tipo === "2") return Math.sqrt(v.reduce((suma, valor) => suma + valor * valor, 0));
  return v.reduce((maximo, valor) => Math.max(maximo, Math.abs(valor)), 0);
}

export const NORMAS = {
  inf: { etiqueta: "∞", descripcion: "norma del máximo" },
  1: { etiqueta: "1", descripcion: "norma suma" },
  2: { etiqueta: "2", descripcion: "norma euclidiana" },
};

export const CRITERIOS = {
  paso: { etiqueta: "Paso", descripcion: "‖X⁽ᵏ⁾ − X⁽ᵏ⁻¹⁾‖ < ε" },
  residual: { etiqueta: "Residual", descripcion: "‖A·X⁽ᵏ⁾ − b‖ < ε" },
  relativo: { etiqueta: "Relativo", descripcion: "‖X⁽ᵏ⁾ − X⁽ᵏ⁻¹⁾‖ / ‖X⁽ᵏ⁾‖ < ε" },
};

/* ----------------------------------------------------- dominancia diagonal */

/**
 * Analiza si A es estrictamente dominante por filas.
 * @returns {{ok:boolean, filas:Array<{i:number, diagonal:number, suma:number, ok:boolean}>, diagonalNula:number[]}}
 */
export function analyzeDiagonalDominance(A) {
  validarMatrizCuadrada(A);
  const filas = A.map((fila, i) => {
    const diagonal = fila[i];
    const suma = fila.reduce((total, valor, j) => (j === i ? total : total + Math.abs(valor)), 0);
    return {
      i,
      diagonal,
      suma,
      ok: Math.abs(diagonal) > suma,
    };
  });
  const diagonalNula = A.map((fila, i) => (fila[i] === 0 ? i : -1)).filter((i) => i >= 0);
  return { ok: filas.every((fila) => fila.ok), filas, diagonalNula };
}

/**
 * Busca un orden de filas que haga la matriz E.D.D. Solo se permutan
 * ecuaciones (filas), como en el apunte. Devuelve el orden de filas (base 0)
 * o null si no existe.
 */
export function findEDDOrder(A) {
  validarMatrizCuadrada(A);
  const n = A.length;
  const sumas = A.map((fila) => fila.reduce((total, valor) => total + Math.abs(valor), 0));

  // La fila r puede ocupar la posición i si su elemento a[r][i] supera la suma
  // del resto de su propia fila; al permutar solo filas, el resto no cambia.
  const puede = (r, i) => Math.abs(A[r][i]) * 2 > sumas[r];

  const posicionDeFila = new Array(n).fill(-1);

  function asignar(r, vistos) {
    for (let i = 0; i < n; i++) {
      if (!puede(r, i) || vistos[i]) continue;
      vistos[i] = true;
      if (posicionDeFila[i] === -1 || asignar(posicionDeFila[i], vistos)) {
        posicionDeFila[i] = r;
        return true;
      }
    }
    return false;
  }

  for (let r = 0; r < n; r++) {
    if (!asignar(r, new Array(n).fill(false))) return null;
  }

  return posicionDeFila;
}

export function applyRowOrder(A, b, orden) {
  return {
    A: orden.map((fila) => [...A[fila]]),
    b: orden.map((fila) => b[fila]),
  };
}

/* -------------------------------------------------------- métodos iterativos */

function comprobarDiagonal(A) {
  for (let i = 0; i < A.length; i++) {
    if (A[i][i] === 0) {
      throw new LinearError(
        `a${sub(i + 1)}${sub(i + 1)} = 0: el método no puede despejar x${sub(i + 1)}. ` +
          "Reordena las ecuaciones o cambia el sistema.",
      );
    }
  }
}

function pasoJacobi(A, b, x) {
  return A.map((fila, i) => {
    let suma = 0;
    for (let j = 0; j < fila.length; j++) if (j !== i) suma += fila[j] * x[j];
    return (b[i] - suma) / fila[i];
  });
}

function pasoGaussSeidel(A, b, x) {
  const siguiente = [...x];
  for (let i = 0; i < A.length; i++) {
    let suma = 0;
    for (let j = 0; j < A[i].length; j++) {
      if (j !== i) suma += A[i][j] * (j < i ? siguiente[j] : x[j]);
    }
    siguiente[i] = (b[i] - suma) / A[i][i];
  }
  return siguiente;
}

function cumpleCriterio(registro, tol, criterio) {
  if (criterio === "residual") return registro.residual < tol;
  if (criterio === "relativo") {
    return registro.relative !== null && registro.relative < tol;
  }
  return registro.step < tol;
}

function ejecutar(A, b, opciones, paso, metodo) {
  const { tol = 1e-8, maxIter = 100, criterio = "paso", norma = "inf", x0 = null } = opciones || {};

  validateSystem(A, b);
  if (!(Number.isFinite(tol) && tol > 0)) {
    throw new LinearError("La tolerancia debe ser un número mayor que cero.");
  }
  if (!Number.isInteger(maxIter) || maxIter < 1) {
    throw new LinearError("El número máximo de iteraciones debe ser un entero al menos 1.");
  }
  if (!(criterio in CRITERIOS)) throw new LinearError("Criterio de detención desconocido.");
  if (!(norma in NORMAS)) throw new LinearError("Norma desconocida.");
  comprobarDiagonal(A);

  const n = A.length;
  const inicial = x0 === null || x0 === undefined ? new Array(n).fill(0) : [...x0];
  if (inicial.length !== n || inicial.some((v) => !Number.isFinite(v))) {
    throw new LinearError(`El vector inicial X⁽⁰⁾ debe tener ${n} componentes numéricas.`);
  }

  let x = [...inicial];
  let residual = vectorNorm(residualVector(A, x, b), norma);
  const historial = [{ k: 0, x: [...x], step: null, residual, relative: null }];

  // Si la norma crece muchísimo respecto de la escala del sistema, ya no es
  // útil seguir iterando: se informa la divergencia en lugar de llenar la
  // tabla con cifras de 10⁶⁰.
  const escala = Math.max(1, vectorNorm(inicial, "inf"), vectorNorm(b, "inf"));
  const limite = 1e12 * escala;

  let converged = false;
  let diverged = false;
  let reason = `Se alcanzó el máximo de ${maxIter} iteraciones sin cumplir la tolerancia`;

  for (let k = 1; k <= maxIter; k++) {
    const xNuevo = paso(A, b, x);

    if (xNuevo.some((valor) => !Number.isFinite(valor))) {
      diverged = true;
      reason = "La iteración divergió: aparecieron valores no finitos.";
      historial.push({ k, x: xNuevo, step: Infinity, residual: Infinity, relative: Infinity });
      break;
    }

    const diferencia = xNuevo.map((valor, i) => valor - x[i]);
    const step = vectorNorm(diferencia, norma);
    residual = vectorNorm(residualVector(A, xNuevo, b), norma);
    const normaX = vectorNorm(xNuevo, norma);
    const relative = normaX > 0 ? step / normaX : step;

    if (!Number.isFinite(step) || !Number.isFinite(residual)) {
      diverged = true;
      reason = "La iteración divergió: las normas crecieron sin límite.";
      historial.push({ k, x: xNuevo, step, residual, relative });
      x = xNuevo;
      break;
    }

    const registro = { k, x: xNuevo, step, residual, relative };
    historial.push(registro);
    x = xNuevo;

    if (cumpleCriterio(registro, tol, criterio)) {
      converged = true;
      const nombre = { paso: "criterio del paso", residual: "criterio del residual", relativo: "criterio relativo" }[criterio];
      reason = `Se cumplió el ${nombre} (${CRITERIOS[criterio].descripcion})`;
      break;
    }

    if (vectorNorm(xNuevo, "inf") > limite) {
      diverged = true;
      reason = "La iteración divergió: la norma del máximo creció más de 10¹² veces la escala del sistema.";
      break;
    }
  }

  const ultimo = historial[historial.length - 1];

  return {
    metodo,
    solution: [...x],
    initial: [...inicial],
    iterations: historial,
    count: historial.length - 1,
    converged,
    diverged,
    reason,
    criterio,
    norma,
    tol,
    maxIter,
    finalStep: ultimo.step,
    finalResidual: ultimo.residual,
    finalRelative: ultimo.relative,
  };
}

/** Método de Jacobi: cada X⁽ᵏ⁾ usa únicamente X⁽ᵏ⁻¹⁾. */
export function jacobi(A, b, opciones = {}) {
  return ejecutar(A, b, opciones, pasoJacobi, "Jacobi");
}

/** Método de Gauss-Seidel: usa las componentes recién calculadas. */
export function gaussSeidel(A, b, opciones = {}) {
  return ejecutar(A, b, opciones, pasoGaussSeidel, "Gauss-Seidel");
}

/* ------------------------------------------- matrices de iteración y radio */

function sustitucionProgresiva(M, rhs) {
  const n = M.length;
  const y = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let suma = rhs[i];
    for (let j = 0; j < i; j++) suma -= M[i][j] * y[j];
    if (M[i][i] === 0) throw new LinearError("No se puede resolver: hay un cero en la diagonal.");
    y[i] = suma / M[i][i];
  }
  return y;
}

/**
 * Matriz de iteración B del método: X⁽ᵏ⁾ = B·X⁽ᵏ⁻¹⁾ + c.
 * Jacobi: B = −D⁻¹(L+U).  Gauss-Seidel: B = −(D+L)⁻¹U.
 */
export function iterationMatrix(A, metodo) {
  validateSystem(A, new Array(A.length).fill(0));
  comprobarDiagonal(A);
  const n = A.length;

  if (metodo === "jacobi") {
    const B = zeros(n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) B[i][j] = -A[i][j] / A[i][i];
      }
    }
    return { B };
  }

  if (metodo !== "gaussSeidel") throw new LinearError("Método desconocido.");

  const M = zeros(n);
  const U = zeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (j <= i) M[i][j] = A[i][j];
      else U[i][j] = A[i][j];
    }
  }

  const B = zeros(n);
  for (let j = 0; j < n; j++) {
    const columna = sustitucionProgresiva(M, U.map((fila) => -fila[j]));
    for (let i = 0; i < n; i++) B[i][j] = columna[i];
  }
  return { B, M };
}

/** Matriz de iteración B y vector c, ya con el b concreto del sistema. */
export function iterationSystem(A, b, metodo) {
  validateSystem(A, b);
  comprobarDiagonal(A);
  const { B, M } = iterationMatrix(A, metodo);
  const c = metodo === "jacobi"
    ? b.map((valor, i) => valor / A[i][i])
    : sustitucionProgresiva(M, b);
  return { B, c };
}

/**
 * Estimación del radio espectral ρ(B) por iteración de potencias con
 * aritmética compleja. Usa el crecimiento geométrico medio, de modo que
 * también funciona con autovalores complejos y con bloques de Jordan.
 */
export function spectralRadius(B, { maxIter = 300 } = {}) {
  const n = B.length;
  if (!n) return 0;
  if (n === 1) return Math.abs(B[0][0]);

  let v = Array.from({ length: n }, (_, i) => ({
    re: Math.cos(0.7 * (i + 1)),
    im: Math.sin(1.3 * (i + 1)),
  }));

  const normaCompleja = (vector) =>
    Math.sqrt(vector.reduce((suma, z) => suma + z.re * z.re + z.im * z.im, 0));

  let norma = normaCompleja(v);
  if (norma === 0) return 0;
  v = v.map((z) => ({ re: z.re / norma, im: z.im / norma }));

  let logCrecimiento = 0;
  let pasos = 0;
  const calentamiento = Math.min(30, Math.max(0, maxIter - 1));

  for (let k = 1; k <= maxIter; k++) {
    const w = B.map((fila) => {
      let re = 0;
      let im = 0;
      for (let j = 0; j < n; j++) {
        re += fila[j] * v[j].re;
        im += fila[j] * v[j].im;
      }
      return { re, im };
    });

    const normaW = normaCompleja(w);
    if (normaW === 0) return 0;
    if (!Number.isFinite(normaW)) return Infinity;

    // Se descartan las primeras iteraciones: el vector todavía puede tener
    // componentes transitorias de autovalores menores.
    if (k > calentamiento) {
      logCrecimiento += Math.log(normaW);
      pasos++;
    }
    v = w.map((z) => ({ re: z.re / normaW, im: z.im / normaW }));
  }

  if (pasos === 0) return 0;
  return Math.exp(logCrecimiento / pasos);
}
