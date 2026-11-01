/**
 * Pruebas del núcleo: analizador de expresiones y métodos numéricos.
 * Se ejecutan con:  node test/core.test.mjs
 */
import assert from "node:assert/strict";
import {
  parseExpression, bisection, regulaFalsi, newton,
  numericDerivative, formatNumber, ParseError,
} from "../core.js";

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed++;
    console.log(`  FALLO ${name}\n       ${error.message}`);
  }
}

function close(actual, expected, tol = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `se esperaba ${expected}, se obtuvo ${actual} (tolerancia ${tol})`,
  );
}

console.log("\nAnalizador de expresiones");
check("x^2 - 2 en √2 da 0", () => close(parseExpression("x^2-2")(Math.SQRT2), 0));
check("multiplicación implícita 2x+1 con x=2", () => close(parseExpression("2x+1")(2), 5));
check("multiplicación implícita 3(x+1) con x=1", () => close(parseExpression("3(x+1)")(1), 6));
check("sin(pi/2) = 1", () => close(parseExpression("sin(pi/2)")(0), 1));
check("precedencia: -x^2 con x=3 vale -9", () => close(parseExpression("-x^2")(3), -9));
check("potencias asociativas a la derecha: 2^3^2 = 512", () => close(parseExpression("2^3^2")(0), 512));
check("notación científica 1e-3", () => close(parseExpression("1e-3")(0), 0.001));
check("expresión con espacios y mayúsculas: 2 * SIN( x )", () => close(parseExpression("2 * SIN( x )")(0), 0));
check("error con nombre desconocido", () => assert.throws(() => parseExpression("foo(x)"), ParseError));
check("error con paréntesis sin cerrar", () => assert.throws(() => parseExpression("(x+1"), ParseError));

console.log("\nBisección");
const f1 = parseExpression("x^2-2");
const b1 = bisection(f1, 0, 2, { tol: 1e-10 });
check("raíz de x²-2 en [0,2] es √2", () => close(b1.root, Math.SQRT2, 1e-9));
check("converge y lo informa", () => assert.equal(b1.converged, true));
check("genera tabla de iteraciones", () => assert.ok(b1.iterations.length > 10));
check("el error final respeta la tolerancia", () => {
  const last = b1.iterations.at(-1);
  assert.ok(last.err <= 1e-10);
});
check("rechaza intervalos sin cambio de signo", () =>
  assert.throws(() => bisection(parseExpression("x^2+1"), -1, 1), /mismo signo/));
check("rechaza extremos iguales", () =>
  assert.throws(() => bisection(f1, 1, 1), /distintos/));

console.log("\nRegula falsi");
const f2 = parseExpression("x^3-2x-5");
const r2 = regulaFalsi(f2, 2, 3, { tol: 1e-10 });
check("raíz de x³-2x-5 en [2,3] es 2.0945514815", () => close(r2.root, 2.0945514815423, 1e-7));
check("converge", () => assert.equal(r2.converged, true));
const r2b = regulaFalsi(f2, 2, 3, { tol: 1e-10, illinois: false });
check("la variante de Illinois no tarda más iteraciones", () =>
  assert.ok(r2.iterations.length <= r2b.iterations.length));
check("rechaza intervalos sin cambio de signo", () =>
  assert.throws(() => regulaFalsi(f2, 3, 4), /mismo signo/));

console.log("\nNewton-Raphson");
const f3 = parseExpression("cos(x)-x");
const n3 = newton(f3, 0.5, { tol: 1e-12 });
check("raíz de cos(x)-x desde 0.5 es 0.7390851332", () => close(n3.root, 0.7390851332151607, 1e-10));
check("converge en pocas iteraciones", () => assert.ok(n3.iterations.length <= 6));
const n4 = newton(parseExpression("x^2-2"), 1, { tol: 1e-12, derivative: parseExpression("2x") });
check("Newton con derivada analítica da √2", () => close(n4.root, Math.SQRT2, 1e-11));
check("avisa si la derivada se anula", () =>
  assert.throws(() => newton(parseExpression("x^2+1"), 0), /derivada/));
check("la derivada numérica aproxima bien", () => {
  const d = numericDerivative((x) => x * x * x, 2);
  close(d, 12, 1e-4);
});

console.log("\nUtilidades");
check("formatNumber con enteros", () => assert.equal(formatNumber(3), "3"));
check("formatNumber con decimales", () => assert.equal(formatNumber(Math.PI, 6), "3.14159"));
check("formatNumber con valores diminutos", () =>
  assert.ok(/×10⁻⁹/.test(formatNumber(1.23e-9)), formatNumber(1.23e-9)));

console.log(`\n${passed} correctas, ${failed} fallidas\n`);
process.exit(failed === 0 ? 0 : 1);
