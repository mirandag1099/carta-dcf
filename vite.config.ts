// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Build a Vercel deployment bundle (Build Output API). The Lovable config runs
  // Nitro only when an explicit `nitro` option is present; otherwise it defaults
  // to cloudflare-module. The config also force-sets the output dir, so we point
  // it at Vercel's expected `.vercel/output` layout (config.json + static/ +
  // functions/__server.func/) — otherwise Vercel can't find the build.
  // `as any`: the Lovable config's `nitro` type only declares preset/output/
  // cloudflare, but it spreads the whole object through to Nitro, which accepts
  // the `vercel` key at runtime (verified in the build output).
  nitro: {
    preset: "vercel",
    output: {
      dir: ".vercel/output",
      publicDir: ".vercel/output/static",
      serverDir: ".vercel/output/functions/__server.func",
    },
    // Pin to a Vercel-supported Node runtime (its builder may use a newer Node
    // than Vercel offers for functions, which would fail the deploy).
    vercel: { functions: { runtime: "nodejs22.x" } },
  } as any,
});
