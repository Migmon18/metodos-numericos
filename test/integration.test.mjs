/**
 * Pruebas del núcleo de integración numérica.
 * Se ejecutan con:  node test/integration.test.mjs
 */
import assert from "node:assert/strict";
import {
  integrationNodes, trapezoid, simpson13, simpson38, integrate,
  sampleFunction, graphRange, IntegrationError,
} from "../integration.js";

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

function close(actual, expected, tol = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tol,
    `se esperaba ${expected}, se obtuvo ${actual} (tolerancia ${tol})`);
}

const f = (x) => Math.sin(x) ** 2;
const A = 0;
const B = Math.PI / 3;
const EXACTA = Math.PI / 6 - Math.sqrt(3) / 8;

console.log("\nNodos");
check("genera N + 1 nodos", () => assert.equal(integrationNodes(f, A, B, 6).length, 7));
check("incluye los extremos", () => {
  const n = integrationNodes(f, A, B, 6);
  close(n[0].x, A); close(n[6].x, B);
});
check("rechaza a >= b", () => assert.throws(() => integrationNodes(f, 1, 1, 4), IntegrationError));
check("rechaza N no entero", () => assert.throws(() => integrationNodes(f, 0, 1, 2.5), IntegrationError));

console.log("\nTrapecio");
check("trapecio simple = π/8", () =>
  close(trapezoid(f, A, B, 1).value, Math.PI / 8, 1e-12));
check("trapecio compuesto N=6 = 0.3092953", () =>
  close(trapezoid(f, A, B, 6).value, 0.3092952889563055, 1e-12));
check("trapecio acepta N=5", () =>
  assert.equal(trapezoid(f, A, B, 5).applicable, true));

console.log("\nSimpson 1/3");
check("simple N=2 = 0.3054326", () =>
  close(simpson13(f, A, B, 2).value, 0.3054326190990076, 1e-12));
check("compuesta N=6 = 0.3070743", () =>
  close(simpson13(f, A, B, 6).value, 0.3070743044736225, 1e-12));
check("rechaza N impar", () => {
  const r = simpson13(f, A, B, 5);
  assert.equal(r.applicable, false);
  assert.match(r.reason, /par/);
});
check("error de la compuesta N=6", () =>
  close(Math.abs(simpson13(f, A, B, 6).value - EXACTA), 1.8120178566671807e-05, 1e-15));

console.log("\nSimpson 3/8");
check("simple N=3 = 0.3063656", () =>
  close(simpson38(f, A, B, 3).value, 0.3063656374925583, 1e-12));
check("compuesta N=6 = 0.3070510", () =>
  close(simpson38(f, A, B, 6).value, 0.3070510457322265, 1e-12));
check("rechaza N no múltiplo de 3", () => {
  const r = simpson38(f, A, B, 4);
  assert.equal(r.applicable, false);
  assert.match(r.reason, /múltiplo de 3/);
});

console.log("\nIntegración completa");
const todo = integrate(f, A, B, 6);
check("h = π/18", () => close(todo.h, Math.PI / 18, 1e-12));
check("incluye las tres reglas", () => {
  assert.equal(todo.trapezoid.applicable, true);
  assert.equal(todo.simpson13.applicable, true);
  assert.equal(todo.simpson38.applicable, true);
});
check("las tres aproximaciones son cercanas", () => {
  close(todo.trapezoid.value, 0.3092953, 1e-6);
  close(todo.simpson13.value, 0.3070743, 1e-6);
  close(todo.simpson38.value, 0.3070510, 1e-6);
});

console.log("\nGráfica");
check("muestrea valores finitos", () => {
  const m = sampleFunction(f, A, B, 100).filter((p) => Number.isFinite(p.y));
  assert.ok(m.length > 95);
});
check("el rango incluye el cero", () => {
  const r = graphRange(f, A, B);
  assert.ok(r.ymin <= 0 && r.ymax >= 0);
});

console.log("\nOtros casos");
check("integral de e^{-x} con Simpson 1/3", () => {
  const r = simpson13((x) => Math.exp(-x), 0, 1, 4);
  close(r.value, 0.6321341753205322, 1e-12);
});
check("integral de 1/(1+x) con Simpson 3/8", () => {
  const r = simpson38((x) => 1 / (1 + x), 0, 1, 6);
  close(r.value, 0.6931953463203464, 1e-12);
});

console.log(`\n${passed} correctas, ${failed} fallidas\n`);
process.exit(failed === 0 ? 0 : 1);
