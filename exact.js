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
  let bAst = null;
  let bTodoPolinomio = true;
  for (const { node, sign } of terminos) {
    if (containsY(node)) {
      const coef = coefficientOfY(node);
      if (!coef) return null;
      a = add(a, scale(coef, sign));
    } else {
      const p = poly(node);
      if (p) b = add(b, scale(p, sign));
      else bTodoPolinomio = false;
      const conSigno = sign < 0 ? { type: "neg", operand: node } : node;
      bAst = bAst ? { type: "bin", op: "+", left: bAst, right: conSigno } : conSigno;
    }
  }
  return {
    a: trim(a),
    b: bTodoPolinomio ? trim(b) : null,
    bAst,
  };
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


/* ------------------------------------------- forzamientos no polinomiales */

function pushTerm(lista, texto) {
  if (!texto || texto === "0") return;
  if (texto.startsWith("-")) lista.push({ signo: "-", cuerpo: texto.slice(1) });
  else lista.push({ signo: "+", cuerpo: texto });
}

function unirTerminos(lista) {
  if (!lista.length) return "0";
  return lista.map((t, i) => i === 0
    ? (t.signo === "-" ? `-${t.cuerpo}` : t.cuerpo)
    : ` ${t.signo} ${t.cuerpo}`).join("");
}

function textoExp(coef, lambda) {
  if (Math.abs(coef) < 1e-12) return "";
  const arg = Math.abs(lambda) < 1e-14 ? "" : lambda === 1 ? "t" : lambda === -1 ? "-t" : `${num(lambda)}*t`;
  const exp = arg ? `exp(${arg})` : "1";
  if (Math.abs(coef - 1) < 1e-12) return exp;
  if (Math.abs(coef + 1) < 1e-12) return `-${exp}`;
  return `${num(coef)}*${exp}`;
}

function textoTrig(sinCoef, cosCoef, omega) {
  const lista = [];
  const arg = Math.abs(omega - 1) < 1e-14 ? "t" : Math.abs(omega + 1) < 1e-14 ? "-t" : `${num(omega)}*t`;
  if (Math.abs(sinCoef) > 1e-12) {
    const abs = Math.abs(sinCoef);
    const cuerpo = Math.abs(abs - 1) < 1e-12 ? `sin(${arg})` : `${num(abs)}*sin(${arg})`;
    lista.push({ signo: sinCoef < 0 ? "-" : "+", cuerpo });
  }
  if (Math.abs(cosCoef) > 1e-12) {
    const abs = Math.abs(cosCoef);
    const cuerpo = Math.abs(abs - 1) < 1e-12 ? `cos(${arg})` : `${num(abs)}*cos(${arg})`;
    lista.push({ signo: cosCoef < 0 ? "-" : "+", cuerpo });
  }
  return unirTerminos(lista);
}

function terminoForzamiento(node, signo) {
  const p = poly(node);
  if (p) return { kind: "poly", p: scale(p, signo) };

  if (node.type === "neg") return terminoForzamiento(node.operand, -signo);

  if (node.type === "bin" && node.op === "*") {
    const fs = factors(node);
    const llamadas = fs.filter((f) => f.type === "call");
    if (llamadas.length !== 1) return null;
    let coef = signo;
    for (const f of fs) {
      if (f === llamadas[0]) continue;
      const cp = poly(f);
      if (!cp || cp.length !== 1) return null;
      coef *= cp[0];
    }
    return terminoForzamiento(llamadas[0], coef);
  }

  if (node.type === "call") {
    const arg = poly(node.arg);
    if (!arg || arg.length > 2) return null;
    const c = arg[0] ?? 0;
    const k = arg[1] ?? 0;
    if (node.name === "exp") {
      if (Math.abs(k) < 1e-14) return { kind: "poly", p: [signo * Math.exp(c)] };
      return { kind: "exp", coef: signo * Math.exp(c), lambda: k };
    }
    if (node.name === "sin" || node.name === "cos") {
      if (Math.abs(k) < 1e-14) {
        return { kind: "poly", p: [signo * (node.name === "sin" ? Math.sin(c) : Math.cos(c))] };
      }
      if (node.name === "sin") {
        return { kind: "trig", omega: k, sin: signo * Math.cos(c), cos: signo * Math.sin(c) };
      }
      return { kind: "trig", omega: k, sin: -signo * Math.sin(c), cos: signo * Math.cos(c) };
    }
  }
  return null;
}

function partesForzamiento(ast) {
  const terminos = [];
  addTerms(ast, 1, terminos);
  const partes = [];
  for (const { node, sign } of terminos) {
    const parte = terminoForzamiento(node, sign);
    if (!parte) return null;
    partes.push(parte);
  }
  return partes;
}

function evaluarPartes(partes, t) {
  let total = 0;
  for (const p of partes) {
    if (p.kind === "poly") total += evaluate(p.p, t);
    else if (p.kind === "exp") total += p.coef * Math.exp(p.lambda * t);
    else if (p.kind === "expPoly") total += p.coef * t * Math.exp(p.lambda * t);
    else if (p.kind === "trig") total += p.sin * Math.sin(p.omega * t) + p.cos * Math.cos(p.omega * t);
  }
  return total;
}

function textoPartes(partes) {
  const lista = [];
  for (const p of partes) {
    if (p.kind === "poly") {
      const txt = formatPoly(p.p);
      if (txt !== "0") {
        if (txt.startsWith("-")) lista.push({ signo: "-", cuerpo: txt.slice(1) });
        else lista.push({ signo: "+", cuerpo: txt });
      }
    } else if (p.kind === "exp") {
      const txt = textoExp(p.coef, p.lambda);
      if (txt) {
        if (txt.startsWith("-")) lista.push({ signo: "-", cuerpo: txt.slice(1) });
        else lista.push({ signo: "+", cuerpo: txt });
      }
    } else if (p.kind === "expPoly") {
      const arg = Math.abs(p.lambda) < 1e-14 ? "" : p.lambda === 1 ? "t" : p.lambda === -1 ? "-t" : `${num(p.lambda)}*t`;
      const cuerpo = `${Math.abs(p.coef - 1) < 1e-12 ? "" : `${num(Math.abs(p.coef))}*`}t${arg ? `*exp(${arg})` : ""}`;
      lista.push({ signo: p.coef < 0 ? "-" : "+", cuerpo });
    } else if (p.kind === "trig") {
      const txt = textoTrig(p.sin, p.cos, p.omega);
      if (txt && txt !== "0") {
        if (txt.startsWith("-")) lista.push({ signo: "-", cuerpo: txt.slice(1) });
        else lista.push({ signo: "+", cuerpo: txt });
      }
    }
  }
  return unirTerminos(lista);
}

function integrarPartes(partes) {
  const salida = [];
  for (const p of partes) {
    if (p.kind === "poly") {
      const F = integrate(p.p);
      if (!isZero(F)) salida.push({ kind: "poly", p: F });
    } else if (p.kind === "exp") {
      if (Math.abs(p.lambda) < 1e-14) salida.push({ kind: "poly", p: [0, p.coef] });
      else salida.push({ kind: "exp", coef: p.coef / p.lambda, lambda: p.lambda });
    } else if (p.kind === "trig") {
      if (Math.abs(p.omega) < 1e-14) salida.push({ kind: "poly", p: [0, p.cos] });
      else salida.push({ kind: "trig", omega: p.omega, sin: p.cos / p.omega, cos: -p.sin / p.omega });
    } else return null;
  }
  return salida;
}

function particularConstante(alpha, partes) {
  const yp = [];
  let bPoly = [0];
  const expParts = [];
  const trigParts = [];

  for (const p of partes) {
    if (p.kind === "poly") bPoly = add(bPoly, p.p);
    else if (p.kind === "exp") expParts.push(p);
    else if (p.kind === "trig") trigParts.push(p);
    else return null;
  }

  if (!isZero(bPoly)) {
    if (Math.abs(alpha) < 1e-14) {
      const F = integrate(bPoly);
      if (!isZero(F)) yp.push({ kind: "poly", p: F });
    } else {
      const d = bPoly.length - 1;
      const c = new Array(d + 1).fill(0);
      c[d] = -bPoly[d] / alpha;
      for (let k = d - 1; k >= 0; k--) c[k] = ((k + 1) * c[k + 1] - bPoly[k]) / alpha;
      yp.push({ kind: "poly", p: trim(c) });
    }
  }

  for (const p of expParts) {
    if (Math.abs(p.lambda - alpha) < 1e-12) {
      yp.push({ kind: "expPoly", coef: p.coef, lambda: alpha });
    } else {
      yp.push({ kind: "exp", coef: p.coef / (p.lambda - alpha), lambda: p.lambda });
    }
  }

  for (const p of trigParts) {
    const den = alpha * alpha + p.omega * p.omega;
    if (den < 1e-14) return null;
    const M = (-alpha * p.sin + p.omega * p.cos) / den;
    const N = (-alpha * p.cos - p.omega * p.sin) / den;
    yp.push({ kind: "trig", omega: p.omega, sin: M, cos: N });
  }

  return yp;
}

function proporcionA(b, a) {
  if (!b || a.length < 2) return null;
  const idx = a.findIndex((v) => Math.abs(v) > 1e-12);
  if (idx < 0) return null;
  const c = b[idx] / a[idx];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (Math.abs((b[i] ?? 0) - c * (a[i] ?? 0)) > 1e-9) return null;
  }
  return c;
}

/* --------------------------------------------------------------- solver */

/** Indica si f(t,y) tiene la forma lineal a(t)y+b(t). */
export function isLinearODE(fText) {
  try { return !!splitLinear(parseAST(fText, ["t", "y"])); }
  catch { return false; }
}

/** Devuelve la expresión y(t) o null si no reconoce una forma cerrada. */
export function solveExact(fText, t0, y0) {
  if (!Number.isFinite(t0) || !Number.isFinite(y0)) return null;
  let ast;
  try { ast = parseAST(fText, ["t", "y"]); }
  catch (error) { if (error instanceof ParseError) return null; throw error; }

  const partes = splitLinear(ast);
  if (!partes) return null;
  const { a, b, bAst } = partes;

  // Caso homogéneo: y' = a(t) y
  if (bAst === null) {
    if (isZero(a)) return num(y0);
    if (a.length === 1) return expTerm(y0, a[0], t0, y0);
    const A = integrate(a);
    const C = y0 * Math.exp(-evaluate(A, t0));
    const arg = formatPoly(A);
    return Math.abs(C - 1) < 1e-12 ? `exp(${arg})` : `${num(C)}*exp(${arg})`;
  }

  // y' = b(t): se integra cada término elemental
  if (isZero(a)) {
    const terminos = partesForzamiento(bAst);
    if (!terminos) return null;
    const F = integrarPartes(terminos);
    if (!F) return null;
    const C = y0 - evaluarPartes(F, t0);
    let texto = textoPartes(F);
    if (Math.abs(C) > 1e-12) {
      if (texto === "0") texto = num(C);
      else texto = C < 0 ? `${texto} - ${num(-C)}` : `${texto} + ${num(C)}`;
    }
    return texto || "0";
  }

  // y' = a y + b(t), con a constante: coeficientes indeterminados
  if (a.length === 1) {
    const alfa = a[0];
    const terminos = partesForzamiento(bAst);
    if (!terminos) return null;
    const yp = particularConstante(alfa, terminos);
    if (!yp) return null;
    const C = (y0 - evaluarPartes(yp, t0)) * Math.exp(-alfa * t0);
    const particular = textoPartes(yp);
    const homogenea = textoExp(C, alfa);
    if (!homogenea) return particular || "0";
    if (!particular || particular === "0") return homogenea;
    if (homogenea.startsWith("-")) return `${particular} - ${homogenea.slice(1)}`;
    return `${particular} + ${homogenea}`;
  }

  // a(t) no constante y b(t) proporcional a a(t):
  // y' = a(t)(y+c)  =>  y = -c + (y0+c) exp(A(t)-A(t0)).
  if (b !== null) {
    const c = proporcionA(b, a);
    if (c === null) return null;
    const A = integrate(a);
    const C = (y0 + c) * Math.exp(-evaluate(A, t0));
    const lista = [];
    if (Math.abs(c) > 1e-12) pushTerm(lista, num(-c));
    if (Math.abs(C) > 1e-12) {
      const arg = formatPoly(A);
      const exp = Math.abs(C - 1) < 1e-12 ? `exp(${arg})` : `${num(C)}*exp(${arg})`;
      pushTerm(lista, exp);
    }
    return unirTerminos(lista);
  }

  return null;
}
