import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'adapters/sql-js/index': 'src/adapters/sql-js/index.ts',
    'adapters/better-sqlite3/index': 'src/adapters/better-sqlite3/index.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  platform: 'neutral',
});
