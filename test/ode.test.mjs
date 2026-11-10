/**
 * Pruebas del núcleo de EDO.
 * Se ejecutan con:  node test/ode.test.mjs
 */
import assert from "node:assert/strict";
import { euler, eulerModified, taylor3, rk4, solveODE, sampleFunction, OdeError } from "../ode.js";
import { parseExpression } from "../core.js";

let passed = 0;
let failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (error) { failed++; console.log(`  FALLO ${name}\n       ${error.message}`); }
}
function close(actual, expected, tol = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tol,
    `se esperaba ${expected}, se obtuvo ${actual} (tolerancia ${tol})`);
}

const f = (t, y) => 2 * t * y;
const ft = (t, y) => 2 * y;
const fy = (t, y) => 2 * t;
const T0 = 0, Y0 = 1, H = 0.1, N = 4;
const EXACTA = Math.exp(0.16);

console.log("\nEuler");
check("Y4 = 1.124448", () => close(euler(f, T0, Y0, H, N).value, 1.124448, 1e-12));
check("incluye N + 1 filas", () => assert.equal(euler(f, T0, Y0, H, N).rows.length, 5));
check("parte en la condición inicial", () => {
  const r = euler(f, T0, Y0, H, N).rows[0];
  assert.equal(r.t, 0); assert.equal(r.y, 1);
});
check("rechaza h = 0", () => assert.throws(() => euler(f, 0, 1, 0, 4), OdeError));
check("rechaza N no entero", () => assert.throws(() => euler(f, 0, 1, 0.1, 0), OdeError));

console.log("\nEuler modificado");
check("Y4 = 1.1731927792", () =>
  close(eulerModified(f, T0, Y0, H, N).value, 1.1731927792435202, 1e-12));
check("es más preciso que Euler", () =>
  assert.ok(Math.abs(eulerModified(f, T0, Y0, H, N).value - EXACTA) <
            Math.abs(euler(f, T0, Y0, H, N).value - EXACTA)));

console.log("\nTaylor 3 términos");
check("Y4 = 1.1718627138", () =>
  close(taylor3(f, ft, fy, T0, Y0, H, N).value, 1.1718627138148798, 1e-12));
check("funciona con derivadas numéricas", () => {
  const r = taylor3(f, null, null, T0, Y0, H, N);
  close(r.value, taylor3(f, ft, fy, T0, Y0, H, N).value, 1e-7);
});

console.log("\nRunge-Kutta 4");
check("Y4 = 1.1735108136", () =>
  close(rk4(f, T0, Y0, H, N).value, 1.173510813600289, 1e-12));
check("error menor que 1e-7", () =>
  assert.ok(Math.abs(rk4(f, T0, Y0, H, N).value - EXACTA) < 1e-7));

console.log("\nSistema completo");
const todo = solveODE(f, { t0: T0, y0: Y0, h: H, N, ft, fy });
check("tEnd = 0.4", () => close(todo.tEnd, 0.4, 1e-12));
check("incluye los cuatro métodos", () => {
  assert.ok(todo.euler && todo.eulerModified && todo.taylor3 && todo.rk4);
});
check("el orden de error es RK4 < Euler modificado < Euler", () => {
  const eE = Math.abs(todo.euler.value - EXACTA);
  const eM = Math.abs(todo.eulerModified.value - EXACTA);
  const eR = Math.abs(todo.rk4.value - EXACTA);
  assert.ok(eR < eM && eM < eE);
});

console.log("\nParser y muestreo");
check("parsea f(t,y)", () => {
  const g = parseExpression("2*t*y + t^2*exp(t)", ["t", "y"]);
  close(g(1, 0), Math.E, 1e-12);
});
check("muestrea la solución exacta", () => {
  const m = sampleFunction((t) => Math.exp(t * t), 0, 0.4, 40);
  assert.equal(m.length, 41);
  close(m[40].y, EXACTA, 1e-12);
});

console.log(`\n${passed} correctas, ${failed} fallidas\n`);
process.exit(failed === 0 ? 0 : 1);
