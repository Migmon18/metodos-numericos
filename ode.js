/**
 * ode.js — Núcleo de ecuaciones diferenciales ordinarias.
 *
 * Métodos de un paso: Euler, Euler modificado (predictor-corrector),
 * Taylor de tres términos y Runge-Kutta de orden 4.
 * No depende del DOM.
 */

export class OdeError extends Error {}

function validar(f, t0, y0, h, N) {
  if (typeof f !== "function") throw new OdeError("La función f(t,y) no es válida.");
  if (![t0, y0, h].every(Number.isFinite)) {
    throw new OdeError("t0, y0 y h deben ser números finitos.");
  }
  if (!(h > 0)) throw new OdeError("El paso h debe ser positivo.");
  if (!Number.isInteger(N) || N < 1) {
    throw new OdeError("El número de pasos N debe ser un entero al menos 1.");
  }
}

function evaluar(f, t, y) {
  const valor = f(t, y);
  if (!Number.isFinite(valor)) {
    throw new OdeError(`f(t,y) no devuelve un valor finito en t = ${t}.`);
  }
  return valor;
}

function fila(k, t, y) {
  return { k, t, y };
}

/** Método de Euler explícito. */
export function euler(f, t0, y0, h, N) {
  validar(f, t0, y0, h, N);
  const rows = [fila(0, t0, y0)];
  let t = t0;
  let y = y0;
  for (let k = 0; k < N; k++) {
    y += h * evaluar(f, t, y);
    t = k === N - 1 ? t0 + N * h : t + h;
    rows.push(fila(k + 1, t, y));
  }
  return { method: "euler", rows, value: y };
}

/** Euler modificado: predictor de Euler y corrector con trapecio. */
export function eulerModified(f, t0, y0, h, N) {
  validar(f, t0, y0, h, N);
  const rows = [fila(0, t0, y0)];
  let t = t0;
  let y = y0;
  for (let k = 0; k < N; k++) {
    const pendienteInicial = evaluar(f, t, y);
    const tSiguiente = t + h;
    const predictor = y + h * pendienteInicial;
    const pendienteFinal = evaluar(f, tSiguiente, predictor);
    y += (h / 2) * (pendienteInicial + pendienteFinal);
    t = k === N - 1 ? t0 + N * h : tSiguiente;
    rows.push(fila(k + 1, t, y));
  }
  return { method: "eulerModified", rows, value: y };
}

function derivadaParcial(f, t, y, respectoA) {
  const escala = 1e-6 * (1 + Math.abs(t) + Math.abs(y));
  if (respectoA === "t") {
    return (evaluar(f, t + escala, y) - evaluar(f, t - escala, y)) / (2 * escala);
  }
  return (evaluar(f, t, y + escala) - evaluar(f, t, y - escala)) / (2 * escala);
}

/**
 * Taylor de tres términos: y, h y' y h²/2 y''.
 * Si no se dan ft y fy, se aproximan por diferencias centrales.
 */
export function taylor3(f, ft, fy, t0, y0, h, N) {
  validar(f, t0, y0, h, N);
  const derivadaT = typeof ft === "function" ? ft : (t, y) => derivadaParcial(f, t, y, "t");
  const derivadaY = typeof fy === "function" ? fy : (t, y) => derivadaParcial(f, t, y, "y");

  const rows = [fila(0, t0, y0)];
  let t = t0;
  let y = y0;
  for (let k = 0; k < N; k++) {
    const pendiente = evaluar(f, t, y);
    const segunda = derivadaT(t, y) + derivadaY(t, y) * pendiente;
    y += h * pendiente + (h * h / 2) * segunda;
    t = k === N - 1 ? t0 + N * h : t + h;
    rows.push(fila(k + 1, t, y));
  }
  return { method: "taylor3", rows, value: y };
}

/** Runge-Kutta clásico de orden 4. */
export function rk4(f, t0, y0, h, N) {
  validar(f, t0, y0, h, N);
  const rows = [fila(0, t0, y0)];
  let t = t0;
  let y = y0;
  for (let k = 0; k < N; k++) {
    const k1 = evaluar(f, t, y);
    const k2 = evaluar(f, t + h / 2, y + (h / 2) * k1);
    const k3 = evaluar(f, t + h / 2, y + (h / 2) * k2);
    const k4 = evaluar(f, t + h, y + h * k3);
    y += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    t = k === N - 1 ? t0 + N * h : t + h;
    rows.push(fila(k + 1, t, y));
  }
  return { method: "rk4", rows, value: y };
}

/** Calcula los cuatro métodos con los mismos datos. */
export function solveODE(f, { t0, y0, h, N, ft = null, fy = null }) {
  validar(f, t0, y0, h, N);
  return {
    t0,
    y0,
    h,
    N,
    tEnd: t0 + N * h,
    euler: euler(f, t0, y0, h, N),
    eulerModified: eulerModified(f, t0, y0, h, N),
    taylor3: taylor3(f, ft, fy, t0, y0, h, N),
    rk4: rk4(f, t0, y0, h, N),
  };
}

/** Muestrea una función de t para la gráfica. */
export function sampleFunction(fn, t0, tEnd, count = 400) {
  const puntos = [];
  const paso = (tEnd - t0) / count;
  for (let i = 0; i <= count; i++) {
    const t = t0 + i * paso;
    const y = fn(t);
    puntos.push({ t, y: Number.isFinite(y) ? y : NaN });
  }
  return puntos;
}
