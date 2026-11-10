/**
 * core.js — Núcleo de la aplicación de métodos numéricos.
 *
 * Contiene un analizador de expresiones (sin `eval`, por seguridad) y los tres
 * métodos de resolución de ecuaciones no lineales. No depende del DOM, de modo
 * que puede probarse con Node y reutilizarse en cualquier interfaz.
 *
 * Expresiones admitidas:
 *   + - * / ^  paréntesis  variable x  constantes pi, e
 *   sin cos tan asin acos atan sinh cosh tanh exp ln log sqrt abs cbrt floor ceil
 *   Multiplicación implícita: 2x, 3(x+1), 2sin(x)
 */

export class ParseError extends Error {}

const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  exp: Math.exp, ln: Math.log, log: Math.log10,
  sqrt: Math.sqrt, abs: Math.abs, cbrt: Math.cbrt,
  floor: Math.floor, ceil: Math.ceil,
};

const CONSTS = { pi: Math.PI, e: Math.E };

// ---------------------------------------------------------------- analizador

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const isDigit = (c) => c >= "0" && c <= "9";
  const isAlpha = (c) => /[a-zA-Z]/.test(c);

  while (i < src.length) {
    const c = src[i];

    if (c === " " || c === "\t" || c === "\n") { i++; continue; }

    if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
      let j = i;
      while (j < src.length && isDigit(src[j])) j++;
      if (src[j] === ".") { j++; while (j < src.length && isDigit(src[j])) j++; }
      // notación científica: 1e-3, 2.5E6 (solo si el exponente es válido)
      if ((src[j] === "e" || src[j] === "E")) {
        let k = j + 1;
        if (src[k] === "+" || src[k] === "-") k++;
        if (isDigit(src[k])) {
          k++;
          while (k < src.length && isDigit(src[k])) k++;
          j = k;
        }
      }
      tokens.push({ kind: "num", value: Number(src.slice(i, j)) });
      i = j;
      continue;
    }

    if (isAlpha(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j++;
      tokens.push({ kind: "id", value: src.slice(i, j).toLowerCase() });
      i = j;
      continue;
    }

    if ("+-*/^()".includes(c)) {
      tokens.push({ kind: "op", value: c });
      i++;
      continue;
    }

    throw new ParseError(`Carácter no válido: «${c}»`);
  }

  return tokens;
}

/**
 * Compila una expresión a una función.
 * Por defecto la variable es x; también se pueden indicar varias variables,
 * por ejemplo ["t", "y"] para una EDO.
 * @param {string} src
 * @param {string[]} [variables]
 * @returns {(...valores: number[]) => number}
 */
export function parseExpression(src, variables = ["x"]) {
  const text = String(src ?? "").trim();
  if (!text) throw new ParseError("La expresión está vacía");

  const nombres = Array.isArray(variables) && variables.length ? variables : ["x"];
  const tokens = tokenize(text);
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (value) => {
    const t = tokens[pos];
    if (!t || t.value !== value) throw new ParseError(`Se esperaba «${value}»`);
    pos++;
    return t;
  };

  // Inicio de un operando, para la multiplicación implícita
  const startsOperand = (t) =>
    !!t && (t.kind === "num" || t.kind === "id" || (t.kind === "op" && t.value === "("));

  function parseExpr() {
    let node = parseTerm();
    while (peek() && peek().kind === "op" && (peek().value === "+" || peek().value === "-")) {
      const op = next().value;
      node = { type: "bin", op, left: node, right: parseTerm() };
    }
    return node;
  }

  function parseTerm() {
    let node = parseUnary();
    for (;;) {
      const t = peek();
      if (t && t.kind === "op" && (t.value === "*" || t.value === "/")) {
        const op = next().value;
        node = { type: "bin", op, left: node, right: parseUnary() };
      } else if (startsOperand(t)) {
        // multiplicación implícita: 2x, 3(x+1), 2sin(x)
        node = { type: "bin", op: "*", left: node, right: parseUnary() };
      } else {
        return node;
      }
    }
  }

  function parseUnary() {
    const t = peek();
    if (t && t.kind === "op" && (t.value === "-" || t.value === "+")) {
      const op = next().value;
      const operand = parseUnary();
      return op === "-" ? { type: "neg", operand } : operand;
    }
    return parsePower();
  }

  function parsePower() {
    const base = parsePrimary();
    if (peek() && peek().kind === "op" && peek().value === "^") {
      next();
      return { type: "bin", op: "^", left: base, right: parseUnary() };
    }
    return base;
  }

  function parsePrimary() {
    const t = next();
    if (!t) throw new ParseError("La expresión termina de forma inesperada");

    if (t.kind === "num") return { type: "num", value: t.value };

    if (t.kind === "id") {
      const indiceVariable = nombres.indexOf(t.value);
      if (indiceVariable >= 0) return { type: "var", index: indiceVariable };
      if (t.value in CONSTS) return { type: "num", value: CONSTS[t.value] };
      if (t.value in FUNCS) {
        expect("(");
        const arg = parseExpr();
        expect(")");
        return { type: "call", name: t.value, arg };
      }
      throw new ParseError(`Nombre desconocido: «${t.value}»`);
    }

    if (t.kind === "op" && t.value === "(") {
      const inner = parseExpr();
      expect(")");
      return inner;
    }

    throw new ParseError(`Símbolo inesperado: «${t.value}»`);
  }

  const ast = parseExpr();
  if (pos !== tokens.length) throw new ParseError("Sobran símbolos al final de la expresión");

  const evaluate = compile(ast);
  const f = (...valores) => evaluate(valores);
  f.source = text;
  f.variables = [...nombres];
  return f;
}

function compile(node) {
  switch (node.type) {
    case "num": {
      const v = node.value;
      return () => v;
    }
    case "var":
      return (args) => args[node.index];
    case "neg": {
      const inner = compile(node.operand);
      return (args) => -inner(args);
    }
    case "call": {
      const fn = FUNCS[node.name];
      const arg = compile(node.arg);
      return (args) => fn(arg(args));
    }
    case "bin": {
      const l = compile(node.left);
      const r = compile(node.right);
      switch (node.op) {
        case "+": return (args) => l(args) + r(args);
        case "-": return (args) => l(args) - r(args);
        case "*": return (args) => l(args) * r(args);
        case "/": return (args) => l(args) / r(args);
        case "^": return (args) => Math.pow(l(args), r(args));
        default: throw new ParseError(`Operador desconocido: ${node.op}`);
      }
    }
    default:
      throw new ParseError("Expresión no válida");
  }
}

// ---------------------------------------------------------------- utilidades

/** Derivada numérica por diferencias centrales. */
export function numericDerivative(f, x, h = 0) {
  const step = h || 1e-6 * (1 + Math.abs(x));
  return (f(x + step) - f(x - step)) / (2 * step);
}

const SUPERINDICES = {
  0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴",
  5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹",
  "-": "⁻", "+": "",
};

/** Da formato legible a un número, con notación científica si hace falta. */
export function formatNumber(v, digits = 10) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (!Number.isFinite(v)) return v > 0 ? "+∞" : "−∞";
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1e6 || abs < 1e-4) {
    const [mantisa, exponente] = v.toExponential(Math.min(6, Math.max(1, digits - 1))).split("e");
    const potencia = exponente
      .replace("+", "")
      .split("")
      .map((c) => SUPERINDICES[c] ?? c)
      .join("");
    return `${mantisa}×10${potencia}`;
  }
  return String(Number(v.toPrecision(digits)));
}

function checkFinite(value, label) {
  if (!Number.isFinite(value)) {
    throw new Error(`f(${label}) no es un número finito. Revisa el dominio de la función.`);
  }
}

function prepare(f, a, b) {
  let fa = f(a);
  let fb = f(b);
  checkFinite(fa, "a");
  checkFinite(fb, "b");
  if (a === b) throw new Error("Los extremos del intervalo deben ser distintos.");
  if (a > b) { [a, b] = [b, a]; [fa, fb] = [fb, fa]; }
  return { a, b, fa, fb };
}

// ---------------------------------------------------------------- métodos

/**
 * Bisección. Requiere cambio de signo en [a, b].
 * @returns {{root:number, iterations:Array, converged:boolean, reason:string}}
 */
export function bisection(f, a, b, { tol = 1e-8, maxIter = 100 } = {}) {
  const start = prepare(f, a, b);
  let { a: lo, b: hi, fa, fb } = start;

  if (fa === 0) return { root: lo, iterations: [], converged: true, reason: "f(a) = 0" };
  if (fb === 0) return { root: hi, iterations: [], converged: true, reason: "f(b) = 0" };
  if (Math.sign(fa) === Math.sign(fb)) {
    throw new Error("f(a) y f(b) tienen el mismo signo: la bisección necesita un cambio de signo.");
  }

  const iterations = [];
  let root = (lo + hi) / 2;
  let converged = false;
  let reason = "Se alcanzó el máximo de iteraciones";

  for (let n = 1; n <= maxIter; n++) {
    const c = (lo + hi) / 2;
    const fc = f(c);
    checkFinite(fc, "c");

    if (Math.sign(fa) === Math.sign(fc)) { lo = c; fa = fc; } else { hi = c; fb = fc; }

    const err = (hi - lo) / 2;
    iterations.push({ n, a: lo, b: hi, c, fc, err });
    root = c;

    if (Math.abs(fc) === 0) { converged = true; reason = "Se encontró f(c) = 0"; break; }
    if (err <= tol) { converged = true; reason = "Se alcanzó la tolerancia"; break; }
  }

  return { root, iterations, converged, reason };
}

/**
 * Regula falsi (falsa posición). Requiere cambio de signo en [a, b].
 * Se incluye la variante de Illinois, que evita el estancamiento de un extremo.
 */
export function regulaFalsi(f, a, b, { tol = 1e-8, maxIter = 100, illinois = true } = {}) {
  const start = prepare(f, a, b);
  let { a: lo, b: hi, fa, fb } = start;

  if (fa === 0) return { root: lo, iterations: [], converged: true, reason: "f(a) = 0" };
  if (fb === 0) return { root: hi, iterations: [], converged: true, reason: "f(b) = 0" };
  if (Math.sign(fa) === Math.sign(fb)) {
    throw new Error("f(a) y f(b) tienen el mismo signo: regula falsi necesita un cambio de signo.");
  }

  const iterations = [];
  let root = lo;
  let previous = null;
  let converged = false;
  let reason = "Se alcanzó el máximo de iteraciones";
  let side = 0; // 1: se repitió el extremo izquierdo, -1: el derecho

  for (let n = 1; n <= maxIter; n++) {
    const denominator = fb - fa;
    if (denominator === 0) throw new Error("f(a) = f(b): no se puede trazar la secante.");

    const c = hi - (fb * (hi - lo)) / denominator;
    const fc = f(c);
    checkFinite(fc, "c");

    const err = previous === null ? Math.abs(hi - lo) : Math.abs(c - previous);
    iterations.push({ n, a: lo, b: hi, c, fc, err });
    previous = c;
    root = c;

    if (Math.abs(fc) === 0) { converged = true; reason = "Se encontró f(c) = 0"; break; }
    if (err <= tol) { converged = true; reason = "Se alcanzó la tolerancia"; break; }

    if (Math.sign(fa) === Math.sign(fc)) {
      lo = c; fa = fc;
      if (illinois && side === 1) fb /= 2;
      side = 1;
    } else {
      hi = c; fb = fc;
      if (illinois && side === -1) fa /= 2;
      side = -1;
    }
  }

  return { root, iterations, converged, reason };
}

/**
 * Newton-Raphson. Si no se da la derivada, se aproxima numéricamente.
 */
export function newton(f, x0, { tol = 1e-8, maxIter = 100, derivative = null } = {}) {
  if (!Number.isFinite(x0)) throw new Error("El valor inicial x₀ debe ser un número.");

  const df = derivative || ((x) => numericDerivative(f, x));
  const iterations = [];
  let x = x0;
  let converged = false;
  let reason = "Se alcanzó el máximo de iteraciones";
  let root = x;

  for (let n = 1; n <= maxIter; n++) {
    const fx = f(x);
    checkFinite(fx, "x");
    if (fx === 0) { converged = true; reason = "Se encontró f(x) = 0"; root = x; break; }

    const dfx = df(x);
    if (!Number.isFinite(dfx) || Math.abs(dfx) < 1e-14) {
      throw new Error(`La derivada se anula en x = ${formatNumber(x, 6)}: Newton no puede continuar.`);
    }

    const xNew = x - fx / dfx;
    if (!Number.isFinite(xNew)) throw new Error("La iteración divergió (valor no finito).");

    const err = Math.abs(xNew - x);
    iterations.push({ n, x, fx, dfx, xNew, err });

    x = xNew;
    root = xNew;

    if (err <= tol) { converged = true; reason = "Se alcanzó la tolerancia"; break; }
  }

  return { root, iterations, converged, reason };
}

/** Muestrea f para dibujarla, descartando puntos no finitos y saltos enormes. */
export function sample(f, xmin, xmax, count = 400) {
  const points = [];
  const step = (xmax - xmin) / count;
  let previous = null;
  for (let i = 0; i <= count; i++) {
    const x = xmin + i * step;
    const y = f(x);
    const ok = Number.isFinite(y);
    if (ok && previous !== null && Math.abs(y - previous) > 1e3) {
      points.push({ x, y: NaN, jump: true });
    }
    points.push({ x, y: ok ? y : NaN });
    if (ok) previous = y;
  }
  return points;
}
