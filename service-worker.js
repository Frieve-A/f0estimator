"use strict";

const CACHE_NAME = "frieve-f0-estimator-v6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js?v=6",
  "./renderer-worker.js?v=6",
  "./audio-worklet.js",
  "./manifest.webmanifest",
  "./assets/ogp.png",
  "./assets/icons/favicon-32.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
];
const NETWORK_FIRST_DESTINATIONS = new Set(["document", "script", "style", "worker", "manifest"]);

function putInCache(request, response) {
  if (!response.ok) {
    return;
  }

  const copy = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
}

function appShellPathMatches(url) {
  return APP_SHELL.some((path) => new URL(path, self.location.href).pathname === url.pathname);
}

function shouldFetchNetworkFirst(request, url) {
  return request.mode === "navigate"
    || NETWORK_FIRST_DESTINATIONS.has(request.destination)
    || (appShellPathMatches(url) && !url.pathname.includes("/assets/"));
}

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      putInCache(request, response);
      return response;
    })
    .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")));
}

function cacheFirst(request) {
  return caches.match(request)
    .then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request)
        .then((response) => {
          putInCache(request, response);
          return response;
        })
        .catch(() => caches.match("./index.html"));
    });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(shouldFetchNetworkFirst(request, url) ? networkFirst(request) : cacheFirst(request));
});
