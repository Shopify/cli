import {build as esBuild} from 'esbuild'

await esBuild({
  bundle: true,
  entryPoints: ['./src/**/*.ts'],
  outdir: './dist/cli',
  platform: 'node',
  format: 'esm',
  inject: ['./bin/cjs-shims.js'],
  external: ['react-devtools-core', 'yoga-wasm-web', '@shopify/cli-kit', '@oclif/core', 'react', 'esbuild', 'ink'],

  loader: {'.node': 'copy', '.wasm': 'copy'},
  splitting: true,
  plugins: [
    // commonjsPlugin(),
  ],
})
