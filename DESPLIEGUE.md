# Publicar la aplicación con HTTPS

Objetivo: una dirección del tipo `https://algo.netlify.app` que funcione desde
cualquier sitio, sin depender de tu ordenador, y que active el modo sin conexión
y la instalación en el móvil.

La app ya está publicada en:

- Repositorio: <https://github.com/Migmon18/metodos-numericos>
- Sitio: <https://migmon18.github.io/metodos-numericos/>

Ya está comprobado que funciona servida en un subdirectorio
(`/metodos-numericos/`), que es el caso de GitHub Pages, y que el service worker
queda bien delimitado a ese ámbito.

## Qué subir

En este repositorio, **la raíz es la aplicación**, con `index.html` en la raíz.

Contiene: `index.html`, `styles.css`, `app.js`, `raices.js`, `sistemas.js`,
`core.js`, `linear.js`, `manifest.webmanifest`, `sw.js`, `assets/` (iconos),
`_headers`, `.nojekyll`. No necesita compilación, ni Node, ni backend.

---

## Opción 1 — Netlify Drop (la más rápida, 2 minutos)

1. Entra en <https://app.netlify.com/drop>.
2. Arrastra **la carpeta `metodos-numericos`** o el `.zip` a la zona de carga.
3. Espera unos segundos: te da una URL tipo
   `https://nombre-aleatorio-123456.netlify.app`.
4. Crea una cuenta gratuita para **conservar el sitio** (si no, caduca).

Para actualizarla: pestaña *Deploys* → arrastra de nuevo la carpeta.

## Opción 2 — Cloudflare Pages

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** →
   **Pages** → **Upload assets**.
2. Arrastra la carpeta o el zip y ponle un nombre al proyecto.
3. URL resultante: `https://nombre.pages.dev`.

## Opción 3 — GitHub Pages (repositorio del curso)

Repositorio: <https://github.com/Migmon18/metodos-numericos>

Para actualizar la app:

```bash
git clone https://github.com/Migmon18/metodos-numericos.git
cd metodos-numericos
# copiar aquí los archivos nuevos
git add .
git commit -m "Añade Jacobi y Gauss-Seidel"
git push origin main
```

En el repositorio: **Settings → Pages → Source: Deploy from a branch →
main / (root) → Save**. En un minuto estará en:

```
https://migmon18.github.io/metodos-numericos/
```

El archivo `.nojekyll` ya incluido evita que GitHub procese los ficheros con
Jekyll.

---

## Después de publicar: comprobaciones

1. Abre la URL en el móvil: debe aparecer el **candado** (HTTPS).
2. En Chrome de Android, menú ⋮ → debe ofrecer **«Instalar aplicación»**.
3. Prueba el modo sin conexión: actívalo en el móvil, recarga y resuelve una
   ecuación. Si sigue funcionando, el service worker está bien.
4. Comprueba un enlace de ejercicio ya cargado:

   ```
   https://migmon18.github.io/metodos-numericos/?f=cos(x)-x&a=0&b=1&x0=0.5&run=1
   ```

## Compartir con el alumnado

- Manda la URL base y, si quieres, un enlace por ejercicio con los parámetros
  (`f`, `a`, `b`, `x0`, `tol`, `m`, `run=1`).
- En iPhone la instalación es distinta: Safari → Compartir → **«Añadir a
  pantalla de inicio»**. Funciona igual, sin tienda de aplicaciones.

## Actualizar la app más adelante

Sube de nuevo la carpeta. Al cambiar `sw.js`, la versión de caché
(`VERSION = "metodos-vN"`, actualmente `metodos-v7`) debe incrementarse para que
los alumnos reciban la nueva versión en lugar de la guardada.

## Enlaces directos a cada módulo

- Raíces: `https://migmon18.github.io/metodos-numericos/`
- Sistemas lineales: `https://migmon18.github.io/metodos-numericos/#sistemas`
- Ejemplo de sistema ya cargado:
  `https://migmon18.github.io/metodos-numericos/?sistema=tridiagonal&run=1`
- Un sistema concreto:
  `https://migmon18.github.io/metodos-numericos/?A=4,-1,0,0;-1,4,-1,0;0,-1,4,-1;0,0,-1,4&b=1,1,1,1&tol=0.1&run=1`
