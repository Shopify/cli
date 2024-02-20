import {build as esBuild} from 'esbuild'

await esBuild({
  bundle: true,
  entryPoints: ['./src/**/*.ts','./src/**/*.tsx'],
  outdir: './dist',
  platform: 'node',
  format: 'esm',
  inject: ['../../bin/cjs-shims.js'],
  external: ['react-devtools-core', 'ink', '@oclif/core', 'shelljs', 'esbuild', 'react'],

  loader: {'.node': 'copy'},
  splitting: true,
  plugins: [],
})
