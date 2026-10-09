# root-pwa
path: public/sw.js
files: public/sw.js, public/manifest.json, public/icons (empty, icons 192/512 referenced but missing)
lines: 49
deps: browser ServiceWorker API, app/offline route, manifest icons
exports: none (service worker globals)
does: Network-first service worker caching root and offline page, serves offline fallback on navigation.
roles: student
db: none
links: app-offline, app-shell, app-home, root-config
