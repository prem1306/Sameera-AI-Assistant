import { fileURLToPath } from 'node:url';
process.env.SAMEERA_MODE = 'web';
if (process.argv.includes('--production')) process.env.NODE_ENV = 'production';
if (process.env.NODE_ENV === 'production') {
  process.env.SAMEERA_APP_ROOT = fileURLToPath(new URL('../', import.meta.url));
  await import('../build/web/server.mjs');
} else {
  const { register } = await import('tsx/esm/api');
  register();
  await import('../server.ts');
}
