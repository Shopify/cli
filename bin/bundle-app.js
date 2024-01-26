import {build as esBuild} from 'esbuild'
// import {commonjs} from '@hyrious/esbuild-plugin-commonjs'
// import commonjsPlugin from '@chialab/esbuild-plugin-commonjs';


await esBuild({
  bundle: true,
  entryPoints: ['./packages/app/src/**/*.ts'],
  outdir: './packages/app/bundled',
  platform: 'node',
  format: 'esm',
  inject: ['./bin/cjs-shims.js'],
  external: ['react-devtools-core', 'yoga-wasm-web', 'git-diff'],

  loader: {'.node': 'copy'},
  splitting: true,
  plugins: [
    // commonjsPlugin(),
  ],
})

