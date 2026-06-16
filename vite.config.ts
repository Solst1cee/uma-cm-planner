/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// GitHub Pages serves from /<repo>/ — CI sets BASE_PATH; local dev stays at /.
export default defineConfig(({ mode }) => {
  // Load .env files (empty prefix → all keys, incl. non-VITE_). TAILNET_HOST lives in the
  // gitignored .env.local and, when set, exposes the dev server over Tailscale.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: process.env.BASE_PATH ?? '/',
    plugins: [react()],
    server: {
      // Bind all interfaces so the Tailscale interface (100.x) is reachable, not just localhost.
      host: true,
      port: 5177,
      strictPort: true,
      // Vite 7 rejects requests whose Host header isn't allowlisted — allow the tailnet MagicDNS
      // name from TAILNET_HOST (set in .env.local); empty allowlist when unset (localhost-only).
      allowedHosts: env.TAILNET_HOST ? [env.TAILNET_HOST] : [],
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['@/sim/vendor/umalator.bundle.mjs'],
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
      restoreMocks: true,
    },
  };
});
