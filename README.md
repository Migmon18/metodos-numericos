# Métodos Numéricos — raíces de ecuaciones

Aplicación web instalable (PWA) para resolver ecuaciones no lineales por
**bisección**, **regula falsi** y **Newton-Raphson**, pensada para clase: el
alumnado ve la tabla de iteraciones y la gráfica, no solo el resultado.

## Qué hace

- **Tres métodos** con tabla de iteraciones completa (n, extremos, punto medio,
  f(c), error).
- **Analizador de expresiones propio**, sin `eval`: admite `+ − * / ^`,
  paréntesis, `x`, `pi`, `e`, multiplicación implícita (`2x`, `3(x+1)`) y las
  funciones `sin cos tan asin acos atan sinh cosh tanh exp ln log sqrt abs cbrt
  floor ceil`.
- **Derivada opcional** para Newton; si se deja vacía se aproxima por
  diferencias centrales.
- **Gráfica** de f(x) con escalas de pasos redondos y la raíz marcada.
- **Exportación a CSV** de las iteraciones (para Excel o para la memoria).
- **Funciona sin conexión** una vez instalada.

## Cómo abrirla

```bash
cd metodos-numericos
python3 -m http.server 8099
# luego abre http://127.0.0.1:8099
```

Sirve cualquier servidor estático; también se puede abrir `index.html` con doble
clic, aunque así el service worker (modo sin conexión) no se activa.

## Instalarla en el móvil

Conviene saber esto antes de prometerlo en clase:

- El modo sin conexión y la instalación como app **requieren HTTPS o
  localhost** (es una restricción de los navegadores, no de la aplicación).
- Por tanto, desde el teléfono con `http://192.168.x.x:8099` se abre
  perfectamente, y se puede añadir un acceso directo a la pantalla de inicio,
  pero **no** funcionará sin conexión.
- Para tenerla instalada de verdad: súbela a un alojamiento estático con HTTPS
  (GitHub Pages, Netlify, Cloudflare Pages) y ábrela desde el móvil. En Chrome
  aparecerá «Instalar aplicación».

  Los pasos concretos están en **[DESPLIEGUE.md](DESPLIEGUE.md)**, y ya existe un
  `metodos-numericos-sitio.zip` listo para arrastrar a Netlify Drop.

## Enlaces para compartir ejercicios

La app acepta parámetros en la URL, útil para mandar un enunciado ya cargado:

```
index.html?f=cos(x)-x&a=0&b=1&x0=0.5&tol=1e-8&m=biseccion,regula,newton&run=1
```

- `f` función, `a` y `b` extremos, `x0` valor inicial, `tol` tolerancia,
  `d` derivada (opcional), `m` métodos separados por comas.
- `run=1` resuelve automáticamente al cargar.

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
index.html               interfaz
styles.css               estilos (claro y oscuro, móvil primero)
app.js                   conexión entre formulario, resultados y gráfica
core.js                  analizador y métodos numéricos (sin DOM, testeable)
manifest.webmanifest     metadatos de la app instalable
sw.js                    service worker (caché sin conexión)
assets/                  iconos (SVG y PNG 192/512, incluida versión maskable)
                         y logos institucionales (utem-color.png, utem-blanco.png)
test/core.test.mjs       pruebas del núcleo
_headers                 cabeceras para Netlify/Cloudflare (sw.js sin caché)
.nojekyll                evita el procesado de Jekyll en GitHub Pages
DESPLIEGUE.md            cómo publicarla con HTTPS
```

## Pruebas

```bash
node test/core.test.mjs
```

28 comprobaciones sobre casos con solución conocida (√2, 2.0945514815,
0.7390851332), precedencia de operadores, errores de sintaxis y detección de
intervalos sin cambio de signo.

## Añadir otro método (secante, punto fijo, …)

1. Implementa la función en `core.js` siguiendo la forma de las existentes:
   devuelve `{ root, iterations, converged, reason }`.
2. Añádela al objeto `METODOS` de `app.js` y al `if` de `resolver()`.
3. Añade la casilla en `index.html` y, si tiene columnas propias, el caso en
   `pintarTabla()`.

## Notas de implementación

- La regula falsi usa la variante de **Illinois** (se puede desactivar con
  `illinois: false`), que evita el estancamiento de un extremo.
- Todos los métodos informan del motivo de parada, no solo del número de
  iteraciones.
- En pantallas estrechas la tabla oculta las columnas menos relevantes
  (`b`, `f′`, `xₙ₊₁`) para que quepan las cifras importantes.
