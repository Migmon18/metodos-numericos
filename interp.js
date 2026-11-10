/**
 * interp.js — Núcleo de interpolación polinomial.
 *
 * Implementa el polinomio de Lagrange, el de Newton con diferencias divididas
 * y utilidades para evaluar y dibujar el polinomio. No depende del DOM, de modo
 * que se puede probar con Node.
 */

export class InterpError extends Error {}

/* --------------------------------------------------------------- puntos */

/** Ordena los puntos por abscisa y rechaza datos inválidos o repetidos. */
export function normalizePoints(points) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new InterpError("Se necesitan al menos dos puntos para interpolar.");
  }

  const limpios = points.map((punto, i) => {
    const x = Number(punto?.x);
    const y = Number(punto?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new InterpError(`El punto ${i + 1} no tiene coordenadas numéricas válidas.`);
    }
    return { x, y };
  });

  limpios.sort((a, b) => a.x - b.x);

  for (let i = 1; i < limpios.length; i++) {
    if (limpios[i].x === limpios[i - 1].x) {
      throw new InterpError(
        `Hay dos puntos con la misma abscisa x = ${limpios[i].x}. ` +
          "Las abscisas deben ser distintas.",
      );
    }
  }

  return limpios;
}

/* ---------------------------------------------------------- polinomios */

function polyAdd(a, b) {
  const n = Math.max(a.length, b.length);
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return out;
}

function polyScale(a, factor) {
  return a.map((v) => v * factor);
}

function polyMul(a, b) {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  }
  return out;
}

/** Evalúa un polinomio con coeficientes en orden ascendente. */
export function evaluatePolynomial(coefficients, x) {
  let resultado = 0;
  for (let i = coefficients.length - 1; i >= 0; i--) {
    resultado = resultado * x + coefficients[i];
  }
  return resultado;
}

export function polynomialDegree(coefficients, tol = 1e-10) {
  for (let i = coefficients.length - 1; i >= 0; i--) {
    if (Math.abs(coefficients[i]) > tol) return i;
  }
  return 0;
}

/* -------------------------------------------------------------- Lagrange */

/** Coeficientes del polinomio de Lagrange, en orden ascendente. */
export function lagrangeCoefficients(points) {
  const pts = normalizePoints(points);
  const n = pts.length;
  let resultado = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    let base = [1];
    let denominador = 1;

    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      base = polyMul(base, [-pts[j].x, 1]);
      denominador *= pts[i].x - pts[j].x;
    }

    resultado = polyAdd(resultado, polyScale(base, pts[i].y / denominador));
  }

  return resultado;
}

/* ---------------------------------------------------------------- Newton */

/** Tabla de diferencias divididas y polinomio expandido de Newton. */
export function newtonInterpolation(points) {
  const pts = normalizePoints(points);
  const n = pts.length;
  const tabla = Array.from({ length: n }, () => new Array(n).fill(null));

  for (let i = 0; i < n; i++) tabla[i][0] = pts[i].y;

  for (let orden = 1; orden < n; orden++) {
    for (let i = 0; i + orden < n; i++) {
      tabla[i][orden] =
        (tabla[i + 1][orden - 1] - tabla[i][orden - 1]) /
        (pts[i + orden].x - pts[i].x);
    }
  }

  const coeficientesNewton = tabla[0].slice();
  let polinomio = [0];
  let termino = [1];

  for (let k = 0; k < n; k++) {
    polinomio = polyAdd(polinomio, polyScale(termino, coeficientesNewton[k]));
    if (k < n - 1) termino = polyMul(termino, [-pts[k].x, 1]);
  }

  return {
    points: pts,
    table: tabla,
    coefficients: coeficientesNewton,
    polynomial: polinomio,
  };
}

/* ------------------------------------------------------------- resultado */

/** Calcula ambos métodos y la evaluación en xEval. */
export function interpolate(points, xEval) {
  const x = Number(xEval);
  if (!Number.isFinite(x)) throw new InterpError("El valor de x para evaluar debe ser numérico.");

  const pts = normalizePoints(points);
  const lagrange = lagrangeCoefficients(pts);
  const newton = newtonInterpolation(pts);
  const valorLagrange = evaluatePolynomial(lagrange, x);
  const valorNewton = evaluatePolynomial(newton.polynomial, x);

  return {
    points: pts,
    x,
    lagrange: {
      coefficients: lagrange,
      degree: polynomialDegree(lagrange),
      value: valorLagrange,
    },
    newton: {
      coefficients: newton.coefficients,
      polynomial: newton.polynomial,
      table: newton.table,
      degree: polynomialDegree(newton.polynomial),
      value: valorNewton,
      points: newton.points,
    },
    degree: Math.max(polynomialDegree(lagrange), polynomialDegree(newton.polynomial)),
    difference: Math.abs(valorLagrange - valorNewton),
  };
}

/* -------------------------------------------------------------- gráfica */

/** Muestrea el polinomio, descartando valores no finitos. */
export function samplePolynomial(coefficients, xmin, xmax, count = 500) {
  const puntos = [];
  const paso = (xmax - xmin) / count;
  for (let i = 0; i <= count; i++) {
    const x = xmin + i * paso;
    const y = evaluatePolynomial(coefficients, x);
    puntos.push({ x, y: Number.isFinite(y) ? y : NaN });
  }
  return puntos;
}

/** Rango horizontal y vertical razonable para dibujar puntos y curva. */
export function graphRange(points, coefficients) {
  const xs = points.map((p) => p.x);
  const xminDatos = Math.min(...xs);
  const xmaxDatos = Math.max(...xs);
  const ancho = xmaxDatos - xminDatos || 1;
  const margenX = ancho * 0.15;

  const xmin = xminDatos - margenX;
  const xmax = xmaxDatos + margenX;
  const muestras = samplePolynomial(coefficients, xmin, xmax, 400).filter((p) => Number.isFinite(p.y));

  const valores = [
    ...points.map((p) => p.y),
    ...muestras.map((p) => p.y),
  ].sort((a, b) => a - b);

  const cuantil = (q) => valores[Math.min(valores.length - 1, Math.max(0, Math.round(q * (valores.length - 1))))];
  let ymin = cuantil(0.02);
  let ymax = cuantil(0.98);

  if (!Number.isFinite(ymin) || !Number.isFinite(ymax)) {
    ymin = Math.min(...points.map((p) => p.y));
    ymax = Math.max(...points.map((p) => p.y));
  }
  if (ymin === ymax) { ymin -= 1; ymax += 1; }
  const holgura = (ymax - ymin) * 0.18;
  ymin -= holgura;
  ymax += holgura;

  return { xmin, xmax, ymin, ymax };
}

/* --------------------------------------------------------------- formato */

const SUPER = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };

function superindice(n) {
  return String(n).split("").map((c) => SUPER[c] ?? c).join("");
}

/** Aproxima un decimal a una fracción sencilla, si la hay. */
export function formatCoefficient(value, digits = 6) {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) < 1e-12) return "0";

  const signo = value < 0 ? "−" : "";
  const absoluto = Math.abs(value);

  // Fracciones con denominador pequeño (1/30, 5/2, etc.).
  for (let den = 1; den <= 200; den++) {
    const num = Math.round(absoluto * den);
    if (Math.abs(absoluto - num / den) < 1e-10 && num > 0) {
      if (num === den) return `${signo}1`;
      if (den === 1) return `${signo}${num}`;
      return `${signo}${num}/${den}`;
    }
  }

  const redondeado = Number(absoluto.toPrecision(digits));
  return signo + String(redondeado);
}

/** Expresión legible del polinomio, con coeficientes ascendentes. */
export function formatPolynomial(coefficients, { digits = 6 } = {}) {
  const terminos = [];
  for (let i = coefficients.length - 1; i >= 0; i--) {
    const coef = coefficients[i];
    if (Math.abs(coef) < 1e-12) continue;

    const abs = Math.abs(coef);
    const signo = coef < 0 ? "−" : "+";
    const cuerpo = formatCoefficient(abs, digits);
    let variable;
    if (i === 0) variable = "";
    else if (i === 1) variable = "x";
    else variable = `x${superindice(i)}`;

    let texto;
    if (i > 0 && Math.abs(abs - 1) < 1e-12) texto = variable;
    else if (i === 0) texto = cuerpo;
    else texto = cuerpo.includes("/") ? `${cuerpo} ${variable}` : `${cuerpo}${variable}`;

    terminos.push({ signo, texto });
  }

  if (!terminos.length) return "0";

  return terminos
    .map((t, i) => {
      if (i === 0) return t.signo === "−" ? `−${t.texto}` : t.texto;
      return ` ${t.signo} ${t.texto}`;
    })
    .join("");
}
