/* sw.js — service worker: guarda la aplicación para que funcione sin conexión. */

const VERSION = "metodos-v13";
const RECURSOS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./raices.js",
  "./sistemas.js",
  "./interpolacion.js",
  "./integracion.js",
  "./edos.js",
  "./core.js",
  "./linear.js",
  "./interp.js",
  "./integration.js",
  "./ode.js",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/utem-color.png",
  "./assets/utem-blanco.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(RECURSOS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  if (peticion.method !== "GET" || !peticion.url.startsWith(self.location.origin)) return;

  evento.respondWith(
    caches.match(peticion).then((guardada) => {
      if (guardada) return guardada;
      return fetch(peticion).then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put(peticion, copia)).catch(() => {});
        }
        return respuesta;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
