/**
 * integration.js — Núcleo de integración numérica.
 *
 * Reglas compuestas de los trapecios, Simpson 1/3 y Simpson 3/8.
 * No depende del DOM; se prueba con Node.
 */

export class IntegrationError extends Error {}

function validar(f, a, b, N) {
  if (typeof f !== "function") throw new IntegrationError("La función no es válida.");
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new IntegrationError("Los extremos a y b deben ser números finitos.");
  }
  if (!(a < b)) throw new IntegrationError("El extremo a debe ser menor que b.");
  if (!Number.isInteger(N) || N < 1) {
    throw new IntegrationError("El número de subintervalos N debe ser un entero al menos 1.");
  }
}

function evaluar(f, x, i) {
  const y = f(x);
  if (!Number.isFinite(y)) {
    throw new IntegrationError(`La función no devuelve un valor finito en x = ${x}.`);
  }
  return y;
}

/** Nodos x_k = a + k h y sus valores f(x_k). */
export function integrationNodes(f, a, b, N) {
  validar(f, a, b, N);
  const h = (b - a) / N;
  return Array.from({ length: N + 1 }, (_, k) => {
    const x = k === N ? b : a + k * h;
    return { k, x, y: evaluar(f, x, k) };
  });
}

/** Regla compuesta de los trapecios. */
export function trapezoid(f, a, b, N) {
  validar(f, a, b, N);
  const h = (b - a) / N;
  const nodos = integrationNodes(f, a, b, N);
  let suma = nodos[0].y + nodos[N].y;
  for (let k = 1; k < N; k++) suma += 2 * nodos[k].y;
  return { method: "trapecio", applicable: true, value: (h / 2) * suma, h, N };
}

/** Regla compuesta de Simpson 1/3. Requiere N par. */
export function simpson13(f, a, b, N) {
  validar(f, a, b, N);
  if (N % 2 !== 0) {
    return {
      method: "simpson13",
      applicable: false,
      value: null,
      h: (b - a) / N,
      N,
      reason: "Simpson 1/3 requiere un número par de subintervalos.",
    };
  }
  const h = (b - a) / N;
  const nodos = integrationNodes(f, a, b, N);
  let suma = nodos[0].y + nodos[N].y;
  for (let k = 1; k < N; k++) suma += (k % 2 === 1 ? 4 : 2) * nodos[k].y;
  return { method: "simpson13", applicable: true, value: (h / 3) * suma, h, N };
}

/** Regla compuesta de Simpson 3/8. Requiere N múltiplo de 3. */
export function simpson38(f, a, b, N) {
  validar(f, a, b, N);
  if (N % 3 !== 0) {
    return {
      method: "simpson38",
      applicable: false,
      value: null,
      h: (b - a) / N,
      N,
      reason: "Simpson 3/8 requiere un número de subintervalos múltiplo de 3.",
    };
  }
  const h = (b - a) / N;
  const nodos = integrationNodes(f, a, b, N);
  let suma = nodos[0].y + nodos[N].y;
  for (let k = 1; k < N; k++) suma += (k % 3 === 0 ? 2 : 3) * nodos[k].y;
  return { method: "simpson38", applicable: true, value: (3 * h / 8) * suma, h, N };
}

/** Calcula las tres reglas con los mismos datos. */
export function integrate(f, a, b, N) {
  validar(f, a, b, N);
  const nodos = integrationNodes(f, a, b, N);
  return {
    a,
    b,
    N,
    h: (b - a) / N,
    nodes: nodos,
    trapezoid: trapezoid(f, a, b, N),
    simpson13: simpson13(f, a, b, N),
    simpson38: simpson38(f, a, b, N),
  };
}

/** Muestrea f para la gráfica, descartando valores no finitos. */
export function sampleFunction(f, a, b, count = 500) {
  const puntos = [];
  const h = (b - a) / count;
  for (let i = 0; i <= count; i++) {
    const x = a + i * h;
    const y = f(x);
    puntos.push({ x, y: Number.isFinite(y) ? y : NaN });
  }
  return puntos;
}

/** Rango vertical razonable para dibujar f y el área. */
export function graphRange(f, a, b) {
  const muestras = sampleFunction(f, a, b, 500).filter((p) => Number.isFinite(p.y));
  const ys = [0, ...muestras.map((p) => p.y)].sort((u, v) => u - v);
  let ymin = ys[Math.max(0, Math.floor(ys.length * 0.02))];
  let ymax = ys[Math.min(ys.length - 1, Math.ceil(ys.length * 0.98))];
  if (ymin === ymax) { ymin -= 1; ymax += 1; }
  const margen = (ymax - ymin) * 0.15 || 1;
  return { xmin: a, xmax: b, ymin: ymin - margen, ymax: ymax + margen };
}
