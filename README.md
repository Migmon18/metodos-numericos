# Métodos Numéricos — raíces, sistemas e interpolación

Aplicación web instalable (PWA) para clase. Reúne tres módulos:

- **Raíces de ecuaciones**: bisección, regula falsi y Newton-Raphson.
- **Sistemas lineales**: métodos iterativos de Jacobi y Gauss-Seidel, siguiendo
  el apunte *Resolución de sistemas de ecuaciones lineales*.
- **Interpolación**: polinomios de Lagrange y de Newton, con tabla de diferencias
  divididas y gráfica de los puntos y del polinomio interpolante.

En todos los casos el alumnado ve el procedimiento completo y una gráfica, no
solo el resultado.

- **Repositorio:** <https://github.com/Migmon18/metodos-numericos>
- **App publicada:** <https://migmon18.github.io/metodos-numericos/>

## Qué hace

### Raíces de ecuaciones

- **Tres métodos** con tabla de iteraciones completa (n, extremos, punto medio,
  f(c), error).
- **Analizador de expresiones propio**, sin `eval`: admite `+ − * / ^`,
  paréntesis, `x`, `pi`, `e`, multiplicación implícita (`2x`, `3(x+1)`) y las
  funciones `sin cos tan asin acos atan sinh cosh tanh exp ln log sqrt abs cbrt
  floor ceil`.
- **Derivada opcional** para Newton; si se deja vacía se aproxima por
  diferencias centrales.
- **Gráfica** de f(x) con escalas de pasos redondos y la raíz marcada.
- **Exportación a CSV** de las iteraciones.

### Sistemas lineales

- **Jacobi y Gauss-Seidel** con la fórmula escalar de cada método.
- **Tres criterios de detención**: paso, residual y relativo; y tres normas:
  ∞, 1 y 2. La tabla muestra `k`, todas las componentes de X⁽ᵏ⁾, `‖ΔX‖`,
  `‖R‖` y el error relativo.
- **Análisis E.D.D.**: indica fila por fila si la matriz es estrictamente
  dominante por filas y, si no lo es, busca un orden de ecuaciones que lo
  consiga y ofrece un botón para reordenarlas.
- **Matrices de iteración** `B_J`, `B_GS`, sus vectores `c` y una estimación del
  radio espectral `ρ(B)`, con la interpretación de convergencia.
- **Gráfica de convergencia** del residual en escala logarítmica, comparando
  ambos métodos.
- **Entrada cómoda**: una fila por línea, valores separados por espacios o comas,
  o directamente la matriz aumentada `A | b`.
- **Exportación a CSV**.

### Interpolación

- **Lagrange y Newton** calculados simultáneamente con los mismos puntos.
- **Tabla editable de puntos** `(x_i, f_i)`, con añadir/quitar filas y ejemplos.
- **Polinomio expandido** con coeficientes en forma decimal o fraccionaria.
- **Tabla de diferencias divididas** de Newton y coeficientes de ambos métodos.
- **Gráfica** con los puntos de interpolación, el polinomio interpolante y una
  línea vertical en el valor evaluado.
- **Exportación a CSV**.

## Cómo abrirla

```bash
cd metodos-numericos
python3 -m http.server 8099
# luego abre http://127.0.0.1:8099
```

Sirve cualquier servidor estático. Conviene usar uno (aunque sea local) porque
los módulos ES no se cargan al abrir `index.html` con `file://` en la mayoría de
los navegadores; con el servidor también se activa el service worker.

## Instalarla en el móvil

- El modo sin conexión y la instalación como app **requieren HTTPS o
  localhost** (es una restricción de los navegadores, no de la aplicación).
- Desde el teléfono con `http://192.168.x.x:8099` se abre perfectamente y se
  puede añadir un acceso directo, pero **no** funcionará sin conexión.
- Para tenerla instalada de verdad: súbela a un alojamiento estático con HTTPS
  (GitHub Pages, Netlify, Cloudflare Pages). En Chrome aparecerá «Instalar
  aplicación».
- La app muestra un aviso **Instalar** cuando el navegador ofrece la
  instalación. Si no aparece, el pie tiene **«¿Cómo instalar la app?»** con los
  pasos para Android, iPhone/iPad y computador.

Los pasos concretos están en **[DESPLIEGUE.md](DESPLIEGUE.md)**.

## Enlaces para compartir ejercicios

### Raíces

```
index.html?f=cos(x)-x&a=0&b=1&x0=0.5&tol=1e-8&m=biseccion,regula,newton&run=1
```

- `f` función, `a` y `b` extremos, `x0` valor inicial, `tol` tolerancia,
  `d` derivada (opcional), `m` métodos separados por comas.
- `run=1` resuelve automáticamente al cargar.

### Sistemas lineales

```
index.html?sistema=tridiagonal&run=1
index.html#sistemas
```

- `sistema` carga uno de los ejemplos: `tridiagonal`, `orden3`, `noedd`,
  `reordenar` o `g4`.
- También se puede enviar el sistema completo:

```
index.html?A=4,-1,0,0;-1,4,-1,0;0,-1,4,-1;0,0,-1,4&b=1,1,1,1&x0=0,0,0,0&tol=0.1&m=jacobi,gaussSeidel&run=1
```

- `A` matriz (filas separadas por `;`), `b`, `x0`, `tol`, `crit`
  (`paso`, `residual`, `relativo`), `norma` (`inf`, `1`, `2`), `maxiter`,
  `m` métodos (`jacobi`, `gaussSeidel`) y `run=1`.
- `#sistemas` abre directamente el módulo de sistemas.

### Interpolación

```
index.html#interpolacion
index.html?puntos=0,-3;1,0;3,5;6,7&x=1.8&run=1
```

- `puntos` contiene pares `x,f(x)` separados por `;`.
- `x` es el valor donde se evalúa el polinomio.
- `run=1` interpola automáticamente al cargar.
- `#interpolacion` abre directamente el módulo.

## Identidad institucional

La cabecera lleva el identificador gráfico de la **Universidad Tecnológica
Metropolitana del Estado de Chile**, extraído del PDF oficial
`IG_UTEM_general.pdf` (guía de identidad, agosto de 2025), y debajo el nombre de
la aplicación.

- **Azul institucional** `#004EAA` (Pantone 2145): botones, enlaces, pestañas
  activas, curva de la gráfica.
- **Verde institucional** `#78BF26` (Pantone 368): raíz en la gráfica y detalles
  de confirmación.
- El logo se usa en **versión color sobre fondo claro** y en **versión monocroma
  blanca sobre fondo oscuro**, como indica la guía. El cambio es automático
  según la preferencia del sistema (`prefers-color-scheme`).
- El icono de la aplicación se generó con la misma paleta.

Los archivos son `assets/utem-color.png` y `assets/utem-blanco.png`.

## Estructura

```
index.html               interfaz de los tres módulos
styles.css               estilos (claro y oscuro, móvil primero)
app.js                   arranque y navegación entre módulos
raices.js                interfaz del módulo de raíces
sistemas.js              interfaz del módulo de sistemas lineales
interpolacion.js         interfaz del módulo de interpolación
core.js                  analizador y métodos de raíces (sin DOM, testeable)
linear.js                Jacobi, Gauss-Seidel, E.D.D. y radio espectral (sin DOM)
interp.js                Lagrange, Newton y diferencias divididas (sin DOM)
manifest.webmanifest     metadatos de la app instalable
sw.js                    service worker (caché sin conexión)
assets/                  iconos y logos institucionales
test/core.test.mjs       pruebas del módulo de raíces
test/linear.test.mjs     pruebas del módulo de sistemas
test/interp.test.mjs     pruebas del módulo de interpolación
_headers                 cabeceras para Netlify/Cloudflare (sw.js sin caché)
.nojekyll                evita el procesado de Jekyll en GitHub Pages
DESPLIEGUE.md            cómo publicarla con HTTPS
```

## Convenciones de escritura

- Los decimales se escriben con **punto** (`0.5`), como en el material del curso.
- En los vectores, las componentes se separan con **coma o espacio**:
  `0, 5, -1` o `0 5 -1`.
- En la matriz, las filas se separan con **salto de línea o `;`**.
- Se admite el signo menos tipográfico `−` al pegar desde un PDF.

## Pruebas

```bash
npm test
# equivale a:
node test/core.test.mjs && node test/linear.test.mjs && node test/interp.test.mjs
```

Son **98 comprobaciones**:

- 28 del módulo de raíces (√2, 2.0945514815, 0.7390851332, precedencia de
  operadores, errores de sintaxis…).
- 47 del módulo de sistemas: lectura de matrices, normas, E.D.D. y
  reordenamiento, todos los ejemplos y ejercicios del apunte (J1–J5, G1–G5),
  criterios de detención, matrices de iteración y radio espectral.
- 23 del módulo de interpolación: puntos, Lagrange, diferencias divididas de
  Newton, evaluación, gráfica y formato de coeficientes.

## Añadir otro método

### Raíces

1. Implementa la función en `core.js` siguiendo la forma de las existentes:
   devuelve `{ root, iterations, converged, reason }`.
2. Añádela al objeto `METODOS` de `raices.js` y al `if` de `resolver()`.
3. Añade la casilla en `index.html` y, si tiene columnas propias, el caso en
   `pintarTabla()`.

### Sistemas

1. Implementa el paso iterativo en `linear.js` y exponlo con la misma forma que
   `jacobi` y `gaussSeidel`.
2. Añade el método a `METODOS` de `sistemas.js`, al `map` de `resolver()` y al
   `fieldset` de `index.html`.
3. Si tiene matriz de iteración propia, añade su caso en `iterationSystem()`.

## Notas de implementación

- La regula falsi usa la variante de **Illinois** (se puede desactivar con
  `illinois: false`), que evita el estancamiento de un extremo.
- Jacobi usa exclusivamente `X⁽ᵏ⁻¹⁾`; Gauss-Seidel actualiza en el lugar y usa
  las componentes recién calculadas.
- El criterio del paso se evalúa con `< ε`, igual que en el apunte.
- El radio espectral se **estima numéricamente** por iteración de potencias con
  aritmética compleja; en los sistemas de ejemplo coincide con el valor esperado
  y se muestra con el símbolo `≈`.
- La búsqueda de un orden E.D.D. solo permuta **filas** (ecuaciones), que es lo
  que conserva el conjunto solución sin cambiar las incógnitas.
- En pantallas estrechas la tabla oculta las columnas menos relevantes para que
  quepan las cifras importantes.
