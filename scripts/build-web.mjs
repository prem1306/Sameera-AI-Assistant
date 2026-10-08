import { build } from 'esbuild';
await build({ entryPoints: ['server.ts'], outfile: 'build/web/server.mjs', platform: 'node', target: 'node22', format: 'esm', bundle: true,
  external: ['vite', 'bufferutil', 'utf-8-validate'],
  banner: { js: "import { createRequire as createNodeRequire } from 'node:module'; const require = createNodeRequire(import.meta.url);" },
});
