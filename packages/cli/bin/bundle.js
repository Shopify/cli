import {build as esBuild} from 'esbuild'

await esBuild({
  bundle: true,
  entryPoints: ['./src/**/*.ts'],
  outdir: './dist',
  platform: 'node',
  format: 'esm',
  inject: ['../../bin/cjs-shims.js'],
  external: ['@shopify/cli-kit', '@oclif/core', 'shelljs'],

  loader: {'.node': 'copy'},
  splitting: true,
  plugins: [],
})
