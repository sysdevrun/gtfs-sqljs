import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  platform: 'neutral',
  // Mark Node.js built-in modules as external to avoid bundling errors
  external: ['fs', 'path', 'os'],
  // Don't bundle node built-ins
  noExternal: [],
});
