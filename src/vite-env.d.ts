/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Minimal typing for reading the deploy base from the build environment in
// vite.config.ts (we deliberately don't pull in all of @types/node).
declare const process: { env: Record<string, string | undefined> };
