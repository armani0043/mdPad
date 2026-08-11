# Dependency decisions

Versions are locked by `package-lock.json` and were reviewed from current npm metadata on
2026-08-10. All direct dependencies use commercial-compatible licenses; there are no application
native addons.

## Application/runtime

- **Electron 43.3.0 (MIT):** sandboxed Windows desktop runtime and native OS integration.
- **React/React DOM 19.2.8 (MIT), Zustand 5.0.14 (MIT):** renderer components and local stores.
- **CodeMirror 6 + Lezer (MIT):** source editing, Markdown/fenced-language highlighting, history,
  autocomplete, search/replace, keyboard commands, and themes.
- **Marked 18.0.9 (MIT):** GFM rendering. Marked output is never trusted directly.
- **DOMPurify 3.4.13 (MPL-2.0 OR Apache-2.0):** preview/visual HTML sanitization.
- **Turndown 7.2.4 + GFM plugin 1.0.2 (MIT):** explicit Visual Mode HTML-to-Markdown conversion.
- **highlight.js 11.11.1 (BSD-3-Clause):** bundled offline preview code highlighting.
- **lucide-react 1.31.0 (ISC):** consistent local vector UI icons.
- **electron-updater 6.8.9 (MIT):** optional, integrity-checked NSIS updates from public GitHub
  Releases. Automatic checks are limited to installed online Windows builds and never gate startup.

## Build/test

- **electron-vite 5.0.0 / Vite 7.3.6 (MIT):** separated Electron bundles and local HMR.
- **electron-builder 26.15.3 (MIT):** maintained NSIS and portable Windows packaging.
- **TypeScript 5.9.3 (Apache-2.0), ESLint 10, Prettier 3.9.6 (MIT):** strict quality gates.
- **Vitest 4.1.10 and happy-dom 20.11.2 (MIT):** unit/filesystem and Visual Mode regression tests.

## Deliberately absent

No SQLite/native addon, telemetry, analytics, document cloud, authentication, payment, AI,
collaboration, activation, licensing, or DRM SDK is included. The only packaged network client is
the narrowly scoped updater; document editing and all user data remain local and fully offline.

Primary implementation references include the Electron security documentation, CodeMirror manual,
Marked security warning, DOMPurify documentation, Turndown repository, and electron-builder Windows
and NSIS target documentation.
