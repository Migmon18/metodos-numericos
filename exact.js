/**
 * exact.js — Solución analítica de EDO de primer orden para formas comunes.
 *
 * Reconoce:
 *   - y' = p(t), con p polinomio;
 *   - y' = a(t) y, con a polinomio (variables separables);
 *   - y' = a y + p(t), con a constante y p polinomio.
 * Para otras formas devuelve null: la solución debe ingresarse a mano.
 */
import { parseAST, ParseError, formatNumber } from "./core.js";

/* ------------------------------------------------------------ polinomios */

function trim(p) {
  const q = [...p];
  while (q.length > 1 && Math.abs(q[q.length - 1]) < 1e-14) q.pop();
  return q.length ? q : [0];
}

function add(a, b) {
  const out = new Array(Math.max(a.length, b.length)).fill(0);
  for (let i = 0; i < out.length; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return trim(out);
}

function sub(a, b) {
  const out = new Array(Math.max(a.length, b.length)).fill(0);
  for (let i = 0; i < out.length; i++) out[i] = (a[i] ?? 0) - (b[i] ?? 0);
  return trim(out);
}

function scale(a, k) { return trim(a.map((v) => v * k)); }

function mul(a, b) {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  return trim(out);
}

function integrate(a) {
  const out = new Array(a.length + 1).fill(0);
  for (let i = 0; i < a.length; i++) out[i + 1] = a[i] / (i + 1);
  return trim(out);
}

function evaluate(a, x) {
  let y = 0;
  for (let i = a.length - 1; i >= 0; i--) y = y * x + a[i];
  return y;
}

function isZero(a) { return a.every((v) => Math.abs(v) < 1e-14); }

/** Polinomio en t a partir del AST; null si no es polinomial o contiene y. */
function poly(node) {
  switch (node.type) {
    case "num": return [node.value];
    case "var": return node.index === 0 ? [0, 1] : null;
    case "neg": {
      const p = poly(node.operand);
      return p ? scale(p, -1) : null;
    }
    case "bin": {
      const a = poly(node.left);
      const b = poly(node.right);
      if (node.op === "+") return a && b ? add(a, b) : null;
      if (node.op === "-") return a && b ? sub(a, b) : null;
      if (node.op === "*") return a && b ? mul(a, b) : null;
      if (node.op === "/") {
        if (!a || !b || b.length !== 1 || Math.abs(b[0]) < 1e-14) return null;
        return scale(a, 1 / b[0]);
      }
      if (node.op === "^") {
        if (!a || !b || b.length !== 1 || !Number.isInteger(b[0]) || b[0] < 0 || b[0] > 12) return null;
        let out = [1];
        for (let i = 0; i < b[0]; i++) out = mul(out, a);
        return out;
      }
      return null;
    }
    default: return null;
  }
}

/* ------------------------------------------------------- partes lineales */

function containsY(node) {
  if (!node) return false;
  if (node.type === "var") return node.index === 1;
  if (node.type === "neg") return containsY(node.operand);
  if (node.type === "call") return containsY(node.arg);
  if (node.type === "bin") return containsY(node.left) || containsY(node.right);
  return false;
}

function addTerms(node, sign, out) {
  if (node.type === "bin" && node.op === "+") {
    addTerms(node.left, sign, out);
    addTerms(node.right, sign, out);
    return;
  }
  if (node.type === "bin" && node.op === "-") {
    addTerms(node.left, sign, out);
    addTerms(node.right, -sign, out);
    return;
  }
  if (node.type === "neg") {
    addTerms(node.operand, -sign, out);
    return;
  }
  out.push({ node, sign });
}

function factors(node, out = []) {
  if (node.type === "bin" && node.op === "*") {
    factors(node.left, out);
    factors(node.right, out);
    return out;
  }
  out.push(node);
  return out;
}

/** Coeficiente polinomial de y en un término, si el término es a(t)*y. */
function coefficientOfY(node) {
  if (!containsY(node)) return null;
  if (node.type === "var" && node.index === 1) return [1];
  if (node.type === "neg") {
    const c = coefficientOfY(node.operand);
    return c ? scale(c, -1) : null;
  }
  if (node.type === "bin" && node.op === "*") {
    const fs = factors(node);
    const yIndex = fs.findIndex((f) => f.type === "var" && f.index === 1);
    if (yIndex < 0) return null;
    if (fs.filter((f) => f.type === "var" && f.index === 1).length !== 1) return null;
    let coef = [1];
    for (let i = 0; i < fs.length; i++) {
      if (i === yIndex) continue;
      const p = poly(fs[i]);
      if (!p) return null;
      coef = mul(coef, p);
    }
    return coef;
  }
  return null;
}

/** Descompone f en a(t)*y + b(t). */
function splitLinear(ast) {
  const terminos = [];
  addTerms(ast, 1, terminos);
  let a = [0];
  let b = [0];
  for (const { node, sign } of terminos) {
    if (containsY(node)) {
      const coef = coefficientOfY(node);
      if (!coef) return null;
      a = add(a, scale(coef, sign));
    } else {
      const p = poly(node);
      if (!p) return null;
      b = add(b, scale(p, sign));
    }
  }
  return { a: trim(a), b: trim(b) };
}

/* -------------------------------------------------------------- formato */

const SUPER = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };

function num(value, digits = 10) {
  if (Math.abs(value) < 1e-12) return "0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  for (let den = 1; den <= 200; den++) {
    const n = Math.round(abs * den);
    if (Math.abs(abs - n / den) < 1e-10 && n > 0) {
      if (n === den) return `${sign}1`;
      if (den === 1) return `${sign}${n}`;
      return `${sign}${n}/${den}`;
    }
  }
  return sign + String(Number(abs.toPrecision(digits)));
}

function formatPoly(p, variable = "t") {
  const q = trim(p);
  const pieces = [];
  for (let i = q.length - 1; i >= 0; i--) {
    const c = q[i];
    if (Math.abs(c) < 1e-12) continue;
    const sign = c < 0 ? "-" : "+";
    const abs = num(Math.abs(c));
    let body;
    if (i === 0) body = abs;
    else {
      const potencia = i === 1 ? variable : `${variable}^${i}`;
      body = Math.abs(Math.abs(c) - 1) < 1e-12 ? potencia : `${abs}*${potencia}`;
    }
    pieces.push({ sign, body });
  }
  if (!pieces.length) return "0";
  return pieces.map((p, i) => i === 0 ? (p.sign === "-" ? `-${p.body}` : p.body) : ` ${p.sign} ${p.body}`).join("");
}

function expTerm(coef, a, t0, y0) {
  // y = yp + C*exp(a*t), con C ajustado por la condición inicial.
  const c = coef * Math.exp(-a * t0);
  if (Math.abs(c) < 1e-12) return "0";
  const factor = a === 1 ? "exp(t)" : a === -1 ? "exp(-t)" : `exp(${num(a)}*t)`;
  if (Math.abs(c - 1) < 1e-12) return factor;
  return `${num(c)}*${factor}`;
}

/* --------------------------------------------------------------- solver */

/** Devuelve la expresión y(t) o null si no reconoce una forma cerrada. */
export function solveExact(fText, t0, y0) {
  if (!Number.isFinite(t0) || !Number.isFinite(y0)) return null;
  let ast;
  try { ast = parseAST(fText, ["t", "y"]); }
  catch (error) { if (error instanceof ParseError) return null; throw error; }

  const partes = splitLinear(ast);
  if (!partes) return null;
  const { a, b } = partes;

  // y' = b(t)
  if (isZero(a)) {
    const F = integrate(b);
    const C = y0 - evaluate(F, t0);
    const cuerpo = formatPoly(F);
    if (Math.abs(C) < 1e-12) return cuerpo;
    return `${cuerpo} ${C < 0 ? "-" : "+"} ${num(Math.abs(C))}`;
  }

  // y' = a y, con a polinomial (variables separables)
  if (b.length === 1 && Math.abs(b[0]) < 1e-14) {
    if (a.length === 1) return expTerm(y0, a[0], t0, y0);
    const A = integrate(a);
    const C = y0 * Math.exp(-evaluate(A, t0));
    const arg = formatPoly(A);
    if (Math.abs(C - 1) < 1e-12) return `exp(${arg})`;
    return `${num(C)}*exp(${arg})`;
  }

  // y' = a y + b(t), solo con a constante
  if (a.length === 1) {
    const alfa = a[0];
    const grado = b.length - 1;
    const yp = new Array(grado + 1).fill(0);
    yp[grado] = -b[grado] / alfa;
    for (let k = grado - 1; k >= 0; k--) {
      yp[k] = ((k + 1) * yp[k + 1] - b[k]) / alfa;
    }
    const particular = trim(yp);
    const C = (y0 - evaluate(particular, t0)) * Math.exp(-alfa * t0);
    const homogenea = expTerm(C, alfa, 0, 1);
    const pTexto = isZero(particular) ? "" : formatPoly(particular);
    if (homogenea === "0") return pTexto || "0";
    if (!pTexto) return homogenea;
    if (homogenea.startsWith("-")) return `${pTexto} - ${homogenea.slice(1)}`;
    return `${pTexto} + ${homogenea}`;
  }

  return null;
}
