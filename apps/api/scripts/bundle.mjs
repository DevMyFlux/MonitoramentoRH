// Production bundle for deploy (Railway, etc.).
//
// Why this exists: `tsc -p tsconfig.json` (the existing "build" script) is
// used for typechecking across the workspace (its outDir mirrors the whole
// monorepo tree because it has to pull in packages/*/src files via the
// tsconfig path mapping) — it was never actually a deployable artifact.
// Running the resulting dist/apps/api/src/server.js directly fails at
// startup: @my-flux/shared's package.json "exports" maps the "import"
// condition straight at its own TS source (packages/shared/src/index.ts) —
// a deliberate "live source in dev" convenience — which plain `node` cannot
// execute (it has no loader for .ts, and that source's own relative imports
// like "./schedule-codes.js" don't exist next to the .ts files, only in that
// package's separately-built dist/).
//
// esbuild sidesteps this cleanly: it bundles @my-flux/* straight from their
// TS source (it transpiles on the fly, so the broken runtime resolution
// never gets a chance to matter) into one self-contained dist/server.js,
// while leaving real npm dependencies as external `require`/`import`s so
// native bits (Prisma's query engine, pg) keep loading the normal way.
import { build } from "esbuild";
import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const apiRoot = fileURLToPath(new URL("..", import.meta.url));

// Real npm dependencies only — @my-flux/* workspace packages are
// deliberately left OUT of this list so esbuild inlines them from source.
const external = [
  "@fastify/cors",
  "@fastify/static",
  "@prisma/adapter-pg",
  "@prisma/client",
  "exceljs",
  "fastify",
  "pg",
  "xlsx",
  "zod"
];

await build({
  entryPoints: [`${apiRoot}src/server.ts`],
  outfile: `${apiRoot}dist/server.js`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  logLevel: "info",
  external,
  banner: {
    // esbuild's ESM output doesn't get CJS's require()/__dirname for free;
    // nothing in this codebase currently needs them, but Prisma's generated
    // client occasionally probes for them — harmless no-op shim either way.
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"
  }
});

// xlsx-renderer.ts resolves its header-image assets relative to its own
// module's import.meta.url. After bundling, that's dist/server.js, so the
// assets need to live at dist/assets/ for that same relative "./assets/"
// lookup to keep resolving correctly.
await mkdir(`${apiRoot}dist/assets`, { recursive: true });
await cp(
  `${apiRoot}src/modules/scheduling/assets`,
  `${apiRoot}dist/assets`,
  { recursive: true }
);

// The built web app (apps/web/dist, built separately — see package.json's
// "deploy:build" at the repo root) gets served by this same process in
// production (app.ts registers @fastify/static against dist/public when it
// exists). Copy it in only if it's actually been built already.
const webDist = fileURLToPath(new URL("../../web/dist/", import.meta.url));
if (existsSync(webDist)) {
  await cp(webDist, `${apiRoot}dist/public`, { recursive: true });
  console.log("Copied apps/web/dist -> apps/api/dist/public");
} else {
  console.log("apps/web/dist not found — skipping (build the web app first for a full deploy bundle)");
}

console.log("Bundled apps/api/dist/server.js");
