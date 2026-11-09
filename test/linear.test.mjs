/**
 * Pruebas del núcleo de sistemas lineales: lectura, normas, dominancia
 * diagonal, Jacobi, Gauss-Seidel, matrices de iteración y radio espectral.
 * Se ejecutan con:  node test/linear.test.mjs
 */
import assert from "node:assert/strict";
import {
  parseLinearSystem, parseVector, validateSystem, vectorNorm, residualVector,
  analyzeDiagonalDominance, findEDDOrder, applyRowOrder,
  jacobi, gaussSeidel, iterationMatrix, iterationSystem, spectralRadius,
  LinearError,
} from "../linear.js";

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

const A1 = [[4, -1, 0, 0], [-1, 4, -1, 0], [0, -1, 4, -1], [0, 0, -1, 4]];
const b1 = [1, 1, 1, 1];
const A2 = [[10, -1, 2], [-1, 11, -1], [2, -1, 10]];
const b2 = [6, 22, -10];

console.log("\nLectura de matrices y vectores");
check("lee una matriz por filas", () => {
  const { A, b, aumentada } = parseLinearSystem("1 2\n3 4");
  assert.deepEqual(A, [[1, 2], [3, 4]]);
  assert.equal(b, null);
  assert.equal(aumentada, false);
});
check("lee la forma aumentada A | b", () => {
  const { A, b, aumentada } = parseLinearSystem("4 -1 | 1\n-1 4 | 1");
  assert.deepEqual(A, [[4, -1], [-1, 4]]);
  assert.deepEqual(b, [1, 1]);
  assert.equal(aumentada, true);
});
check("admite comas y punto y coma", () => {
  const { A } = parseLinearSystem("1,2;3,4");
  assert.deepEqual(A, [[1, 2], [3, 4]]);
});
check("rechaza matrices no cuadradas", () =>
  assert.throws(() => parseLinearSystem("1 2 3\n4 5 6"), /cuadrada/));
check("el vector vacío se vuelve ceros si se pide", () =>
  assert.deepEqual(parseVector("", 3, { ceroPorDefecto: true }), [0, 0, 0]));
check("rechaza un vector con dimensión equivocada", () =>
  assert.throws(() => parseVector("1 2", 3), /3 componentes/));
check("validateSystem acepta un sistema correcto", () =>
  assert.deepEqual(validateSystem(A2, b2), { n: 3 }));
check("validateSystem rechaza b de otra dimensión", () =>
  assert.throws(() => validateSystem(A2, [1, 2]), /3 componentes/));

console.log("\nNormas y residual");
check("norma 1 de (2,-3,1)", () => close(vectorNorm([2, -3, 1], "1"), 6));
check("norma 2 de (2,-3,1)", () => close(vectorNorm([2, -3, 1], "2"), Math.sqrt(14)));
check("norma infinito de (2,-3,1)", () => close(vectorNorm([2, -3, 1], "inf"), 3));
check("residual de un sistema 2x2", () =>
  assert.deepEqual(residualVector([[2, 1], [1, 3]], [1, 2], [4, 7]), [0, 0]));

console.log("\nDominancia diagonal");
check("reconoce la matriz E.D.D. del Ejemplo 2", () =>
  assert.equal(analyzeDiagonalDominance(A2).ok, true));
check("reconoce la matriz no E.D.D. del Ejemplo 4.1", () => {
  const analisis = analyzeDiagonalDominance([[2, 1, 0], [1, 2, 1], [0, 1, 2]]);
  assert.equal(analisis.ok, false);
  assert.equal(analisis.filas[1].ok, false);
});
check("encuentra el orden 3, 1, 2 del ejercicio J3", () => {
  const A = [[2, -6, -1], [-3, -1, 7], [-8, 1, -2]];
  assert.deepEqual(findEDDOrder(A), [2, 0, 1]);
});
check("devuelve null si no hay orden E.D.D. posible", () =>
  assert.equal(findEDDOrder([[2, 1, 0], [1, 2, 1], [0, 1, 2]]), null));
check("al reordenar, la matriz queda E.D.D.", () => {
  const A = [[2, -6, -1], [-3, -1, 7], [-8, 1, -2]];
  const b = [6, 12, -13];
  const orden = findEDDOrder(A);
  const reordenado = applyRowOrder(A, b, orden);
  assert.equal(analyzeDiagonalDominance(reordenado.A).ok, true);
  assert.deepEqual(reordenado.b, [-13, 6, 12]);
});

console.log("\nJacobi");
check("Ejemplo 1: 3 iteraciones con ε = 0.1", () => {
  const r = jacobi(A1, b1, { tol: 0.1 });
  assert.equal(r.count, 3);
  assert.equal(r.converged, true);
  closeVector(r.solution, [0.34375, 0.421875, 0.421875, 0.34375]);
});
check("Ejemplo 2: criterio del paso termina en k = 5", () => {
  const r = jacobi(A2, b2, { tol: 0.01, criterio: "paso" });
  assert.equal(r.count, 5);
  assert.equal(r.converged, true);
});
check("Ejemplo 2: criterio del residual termina en k = 6", () => {
  const r = jacobi(A2, b2, { tol: 0.01, criterio: "residual" });
  assert.equal(r.count, 6);
  close(r.finalResidual, 0.003302, 1e-6);
});
check("J1: 6 iteraciones con ε = 10⁻³", () => {
  const r = jacobi([[5, -1, 1], [2, 8, -1], [-1, 1, 6]], [5, 9, 6], { tol: 1e-3 });
  assert.equal(r.count, 6);
  closeVector(r.solution, [1.000254, 1.000091, 0.999757], 1e-6);
});
check("J2: 8 iteraciones con ε = 10⁻⁴", () => {
  const r = jacobi([[10, 1, -1], [1, 10, 2], [-1, 2, 10]], [10, 13, 11], { tol: 1e-4 });
  assert.equal(r.count, 8);
});
check("J3 reordenado: 7 iteraciones con ε = 10⁻²", () => {
  const A = [[2, -6, -1], [-3, -1, 7], [-8, 1, -2]];
  const b = [6, 12, -13];
  const { A: Ar, b: br } = applyRowOrder(A, b, findEDDOrder(A));
  const r = jacobi(Ar, br, { tol: 1e-2 });
  assert.equal(r.count, 7);
  closeVector(r.solution, [1.000258, -0.999214, 2.001408], 1e-6);
});
check("J3 sin reordenar diverge y se detiene antes del máximo", () => {
  const r = jacobi([[2, -6, -1], [-3, -1, 7], [-8, 1, -2]], [6, 12, -13], { tol: 1e-2, maxIter: 100 });
  assert.equal(r.converged, false);
  assert.equal(r.diverged, true);
  assert.ok(r.count < 100);
});
check("Ejemplo 4.1 (no E.D.D.) converge", () => {
  const r = jacobi([[2, 1, 0], [1, 2, 1], [0, 1, 2]], [3, 4, 3], { tol: 1e-10 });
  assert.equal(r.converged, true);
  closeVector(r.solution, [1, 1, 1], 1e-6);
});
check("J4: reconstruye A y b desde B_J y calcula X¹, X², X³", () => {
  const A = [[4, -1, -1], [-1, 5, -1], [-1, -1, 6]];
  const b = [4, 5, 6];
  assert.equal(analyzeDiagonalDominance(A).ok, true);
  const r = jacobi(A, b, { tol: 1e-15, maxIter: 3 });
  closeVector(r.iterations[1].x, [1, 1, 1]);
  closeVector(r.iterations[2].x, [1.5, 1.4, 1.333333], 1e-6);
  closeVector(r.iterations[3].x, [1.683333, 1.566667, 1.483333], 1e-6);
});
check("J5: residual y error de una aproximación", () => {
  const A = [[5, -1, 1], [2, 8, -1], [-1, 1, 6]];
  const b = [5, 9, 6];
  const aproximacion = [1.0, 1.2, 0.9];
  const residual = residualVector(A, aproximacion, b);
  closeVector(residual, [-0.3, 1.7, -0.4]);
  close(vectorNorm(residual, "inf"), 1.7);
  const error = [1, 1, 1].map((valor, i) => valor - aproximacion[i]);
  closeVector(error, [0, -0.2, 0.1]);
  close(vectorNorm(error, "inf"), 0.2);
});

console.log("\nGauss-Seidel");
check("Ejemplo 1: 3 iteraciones con ε = 0.1", () => {
  const r = gaussSeidel(A1, b1, { tol: 0.1 });
  assert.equal(r.count, 3);
  closeVector(r.solution, [0.353515625, 0.4475097656, 0.4516601563, 0.3629150391]);
});
check("Ejemplo 2: criterio del paso termina en k = 4", () => {
  const r = gaussSeidel(A2, b2, { tol: 0.01, criterio: "paso" });
  assert.equal(r.count, 4);
});
check("Ejemplo 2: criterio del residual termina en k = 3", () => {
  const r = gaussSeidel(A2, b2, { tol: 0.01, criterio: "residual" });
  assert.equal(r.count, 3);
  close(r.finalResidual, 0.002985, 1e-6);
});
check("G1: 5 iteraciones con ε = 10⁻³", () => {
  const r = gaussSeidel([[5, -1, 1], [2, 8, -1], [-1, 1, 6]], [5, 9, 6], { tol: 1e-3 });
  assert.equal(r.count, 5);
  closeVector(r.solution, [1.000069, 0.999968, 1.000017], 1e-6);
});
check("G2: 6 iteraciones con ε = 10⁻⁴", () => {
  const r = gaussSeidel([[10, 1, -1], [1, 10, 2], [-1, 2, 10]], [10, 13, 11], { tol: 1e-4 });
  assert.equal(r.count, 6);
});
check("G3: 4 iteraciones con ε = 10⁻²", () => {
  const A = [[2, -6, -1], [-3, -1, 7], [-8, 1, -2]];
  const b = [6, 12, -13];
  const { A: Ar, b: br } = applyRowOrder(A, b, findEDDOrder(A));
  const r = gaussSeidel(Ar, br, { tol: 1e-2 });
  assert.equal(r.count, 4);
});
check("G4: dos iteraciones desde cero", () => {
  const r = gaussSeidel([[6, -1, 1], [-1, 7, -2], [2, -1, 8]], [6, 4, 9], { tol: 1e-9, maxIter: 2 });
  assert.equal(r.count, 2);
  closeVector(r.solution, [0.958333, 0.983844, 1.008397], 1e-6);
  close(r.finalStep, 0.269558, 1e-6);
  close(r.finalResidual, 0.225447, 1e-6);
});
check("G5: con ε = 10⁻⁶, Jacobi 15 y Gauss-Seidel 8", () => {
  const A = [[6, -1, 1], [-1, 7, -2], [2, -1, 8]];
  const b = [6, 4, 9];
  assert.equal(jacobi(A, b, { tol: 1e-6 }).count, 15);
  assert.equal(gaussSeidel(A, b, { tol: 1e-6 }).count, 8);
});

console.log("\nCriterios, errores y opciones");
check("el criterio relativo también converge", () => {
  const r = gaussSeidel(A2, b2, { tol: 1e-8, criterio: "relativo" });
  assert.equal(r.converged, true);
});
check("la tabla incluye k = 0 con el residual inicial", () => {
  const r = jacobi(A2, b2, { tol: 0.01 });
  assert.equal(r.iterations[0].k, 0);
  assert.equal(r.iterations[0].step, null);
  close(r.iterations[0].residual, 22);
});
check("rechaza una diagonal nula", () =>
  assert.throws(() => jacobi([[0, 1], [1, 1]], [1, 1]), /a₁₁ = 0/));
check("rechaza tolerancias no positivas", () =>
  assert.throws(() => jacobi(A2, b2, { tol: 0 }), /tolerancia/));
check("informa si no alcanza la tolerancia", () => {
  const r = jacobi(A2, b2, { tol: 1e-12, maxIter: 2 });
  assert.equal(r.converged, false);
  assert.match(r.reason, /máximo de 2 iteraciones/);
});

console.log("\nMatrices de iteración y radio espectral");
check("B_J del sistema 2x2", () => {
  const { B, c } = iterationSystem([[4, 1], [3, 8]], [1, 2], "jacobi");
  assert.deepEqual(B, [[0, -0.25], [-0.375, 0]]);
  closeVector(c, [0.25, 0.25]);
});
check("B_GS reproduce un paso de Gauss-Seidel", () => {
  const A = [[4, 1], [3, 8]];
  const b = [1, 2];
  const { B, c } = iterationSystem(A, b, "gaussSeidel");
  const x0 = [0.5, 0.25];
  const paso = gaussSeidel(A, b, { x0, maxIter: 1, tol: 1e-15 });
  const multiplicado = B.map((fila, i) => fila.reduce((s, v, j) => s + v * x0[j], 0) + c[i]);
  closeVector(multiplicado, paso.iterations[1].x, 1e-12);
});
check("ρ(B_J) del sistema no E.D.D. es 0.7071", () => {
  const { B } = iterationSystem([[2, 1, 0], [1, 2, 1], [0, 1, 2]], [3, 4, 3], "jacobi");
  close(spectralRadius(B), Math.SQRT1_2, 1e-6);
});
check("ρ(B_GS) del sistema no E.D.D. es 0.5", () => {
  const { B } = iterationSystem([[2, 1, 0], [1, 2, 1], [0, 1, 2]], [3, 4, 3], "gaussSeidel");
  close(spectralRadius(B), 0.5, 1e-6);
});
check("ρ(B) del Ejemplo 4.2 es aproximadamente 0.8", () => {
  close(spectralRadius([[0.8, 5, 0], [0, 0.8, 0], [0, 0, 0.5]]), 0.8, 0.01);
});
check("ρ(B) del Ejemplo 4.3 es 1.5", () => {
  close(spectralRadius([[0.9, 1.2, 0], [-1.2, 0.9, 0], [0, 0, 0.5]]), 1.5, 1e-6);
});
check("rechaza métodos desconocidos", () =>
  assert.throws(() => iterationMatrix([[1]], "otro"), LinearError));

console.log(`\n${passed} correctas, ${failed} fallidas\n`);
process.exit(failed === 0 ? 0 : 1);
