# Publicar la aplicación con HTTPS

Objetivo: una dirección del tipo `https://algo.netlify.app` que funcione desde
cualquier sitio, sin depender de tu ordenador, y que active el modo sin conexión
y la instalación en el móvil.

Ya está comprobado que la app funciona servida en un subdirectorio
(`/metodos-numericos/`), que es el caso de GitHub Pages, y que el service worker
queda bien delimitado a ese ámbito.

## Qué subir

La carpeta `metodos-numericos` **tal cual**, o el archivo
`metodos-numericos-sitio.zip` (ya preparado, con `index.html` en la raíz).

Contiene: `index.html`, `styles.css`, `app.js`, `core.js`,
`manifest.webmanifest`, `sw.js`, `assets/` (iconos), `_headers`, `.nojekyll`.
No necesita compilación, ni Node, ni backend.

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

## Opción 3 — GitHub Pages (si ya usas Git)

```bash
cd metodos-numericos
git init -b main
git add .
git commit -m "Aplicación de métodos numéricos"
```

Crea un repositorio **vacío y público** en <https://github.com/new> llamado
`metodos-numericos`, y luego:

```bash
git remote add origin https://github.com/TU-USUARIO/metodos-numericos.git
git push -u origin main
```

En el repositorio: **Settings → Pages → Source: Deploy from a branch →
main / (root) → Save**. En un minuto estará en:

```
https://TU-USUARIO.github.io/metodos-numericos/
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
   https://TU-DIRECCION/?f=cos(x)-x&a=0&b=1&x0=0.5&run=1
   ```

## Compartir con el alumnado

- Manda la URL base y, si quieres, un enlace por ejercicio con los parámetros
  (`f`, `a`, `b`, `x0`, `tol`, `m`, `run=1`).
- En iPhone la instalación es distinta: Safari → Compartir → **«Añadir a
  pantalla de inicio»**. Funciona igual, sin tienda de aplicaciones.

## Actualizar la app más adelante

Sube de nuevo la carpeta. Al cambiar `sw.js`, la versión de caché
(`VERSION = "metodos-vN"`) debe incrementarse para que los alumnos reciban la
nueva versión en lugar de la guardada.
