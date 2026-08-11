import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// Strict Content Security Policy for production builds. In development the
// Vite/React-refresh tooling needs inline scripts and the HMR websocket, so
// the dev policy is relaxed for exactly those two things.
const CSP_PROD =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; " +
  "base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
const CSP_DEV =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; font-src 'self'; connect-src 'self' ws: http://localhost:*; " +
  "object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";

/** Injects the CSP meta tag into src/renderer/index.html (placeholder comment). */
function cspPlugin(): Plugin {
  return {
    name: 'mdpad-csp',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const csp = ctx.server ? CSP_DEV : CSP_PROD;
        return html.replace(
          '<!-- %MDPAD_CSP% -->',
          `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
        );
      },
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: 'src/main/index.ts' },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: 'src/preload/index.ts' },
        output: {
          // Sandboxed preload scripts must be CommonJS.
          format: 'cjs',
        },
      },
    },
  },
  renderer: {
    plugins: [react(), cspPlugin()],
  },
});
