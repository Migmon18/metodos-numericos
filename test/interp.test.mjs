/**
 * Pruebas del núcleo de interpolación polinomial.
 * Se ejecutan con:  node test/interp.test.mjs
 */
import assert from "node:assert/strict";
import {
  normalizePoints, lagrangeCoefficients, newtonInterpolation, interpolate,
  evaluatePolynomial, polynomialDegree, samplePolynomial, graphRange,
  formatCoefficient, formatPolynomial, InterpError,
} from "../interp.js";

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

function closeVector(actual, expected, tol = 1e-9) {
  assert.equal(actual.length, expected.length, "longitud del vector");
  actual.forEach((valor, i) => close(valor, expected[i], tol));
}

const P = [
  { x: 0, y: -3 },
  { x: 1, y: 0 },
  { x: 3, y: 5 },
  { x: 6, y: 7 },
];

console.log("\nPuntos");
check("ordena los puntos por abscisa", () => {
  const pts = normalizePoints([{ x: 3, y: 5 }, { x: 0, y: -3 }, { x: 1, y: 0 }]);
  assert.deepEqual(pts.map((p) => p.x), [0, 1, 3]);
});
check("rechaza abscisas repetidas", () =>
  assert.throws(() => normalizePoints([{ x: 1, y: 2 }, { x: 1, y: 3 }]), InterpError));
check("rechaza coordenadas no numéricas", () =>
  assert.throws(() => normalizePoints([{ x: 0, y: 1 }, { x: "a", y: 2 }]), InterpError));
check("rechaza menos de dos puntos", () =>
  assert.throws(() => normalizePoints([{ x: 0, y: 1 }]), /dos puntos/));

console.log("\nLagrange");
const lag = lagrangeCoefficients(P);
check("coeficientes del ejemplo del apunte", () =>
  closeVector(lag, [-3, 46 / 15, -1 / 30, -1 / 30], 1e-9));
check("evalúa P(1.8) = 2.2176", () => close(evaluatePolynomial(lag, 1.8), 2.2176, 1e-9));
check("pasa por los cuatro nodos", () => {
  for (const p of P) close(evaluatePolynomial(lag, p.x), p.y, 1e-9);
});
check("el grado es 3", () => assert.equal(polynomialDegree(lag), 3));

console.log("\nNewton");
const newton = newtonInterpolation(P);
check("tabla de diferencias divididas", () => {
  closeVector(newton.table[0].slice(0, 4), [-3, 3, -1 / 6, -1 / 30], 1e-9);
  closeVector(newton.table[1].slice(0, 3), [0, 5 / 2, -11 / 30], 1e-9);
  close(newton.table[1][2], -11 / 30, 1e-9);
});
check("coeficientes de Newton", () =>
  closeVector(newton.coefficients, [-3, 3, -1 / 6, -1 / 30], 1e-9));
check("polinomio expandido coincide con Lagrange", () =>
  closeVector(newton.polynomial, lag, 1e-9));
check("evalúa P(1.8) = 2.2176", () =>
  close(evaluatePolynomial(newton.polynomial, 1.8), 2.2176, 1e-9));

console.log("\nResultado combinado");
const result = interpolate(P, 1.8);
check("ambos valores coinciden", () => close(result.lagrange.value, result.newton.value, 1e-9));
check("la diferencia numérica es despreciable", () => assert.ok(result.difference < 1e-9));
check("el grado global es 3", () => assert.equal(result.degree, 3));
check("x de evaluación se conserva", () => assert.equal(result.x, 1.8));

console.log("\nCasos pequeños");
check("dos puntos producen una recta", () => {
  const r = interpolate([{ x: 1, y: 2 }, { x: 3, y: 6 }], 2);
  closeVector(r.lagrange.coefficients, [0, 2], 1e-12);
  close(r.lagrange.value, 4, 1e-12);
});
check("tres puntos producen una parábola", () => {
  const r = interpolate([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 2 }], 1.5);
  closeVector(r.lagrange.coefficients, [1, 3.5, -1.5], 1e-12);
  close(r.lagrange.value, 2.875, 1e-12);
});
check("un polinomio de grado bajo no produce diferencias altas", () => {
  const r = interpolate([{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 5 }], 3);
  closeVector(r.lagrange.coefficients, [1, 0, 1], 1e-12);
  close(r.lagrange.value, 10, 1e-12);
});

console.log("\nGráfica");
check("muestrea valores finitos", () => {
  const puntos = samplePolynomial(lag, -0.5, 6.5, 50).filter((p) => Number.isFinite(p.y));
  assert.ok(puntos.length > 40);
});
check("el rango contiene los nodos y la curva", () => {
  const rango = graphRange(P, lag);
  assert.ok(rango.xmin < 0 && rango.xmax > 6);
  assert.ok(rango.ymin < -3 && rango.ymax > 7);
});

console.log("\nFormato");
check("fracciones sencillas", () => {
  assert.equal(formatCoefficient(-1 / 30), "−1/30");
  assert.equal(formatCoefficient(46 / 15), "46/15");
  assert.equal(formatCoefficient(1), "1");
  assert.equal(formatCoefficient(0), "0");
});
check("polinomio legible", () => {
  const texto = formatPolynomial(lag);
  assert.match(texto, /x³/);
  assert.match(texto, /46\/15 x/);
  assert.match(texto, /− 3$/);
});

console.log(`\n${passed} correctas, ${failed} fallidas\n`);
process.exit(failed === 0 ? 0 : 1);
