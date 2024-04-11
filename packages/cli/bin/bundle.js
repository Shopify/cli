/* eslint-disable @shopify/cli/specific-imports-in-bootstrap-code */
/* eslint-disable import/no-extraneous-dependencies */
import cleanBundledDependencies from '../../../bin/bundling/clean-bundled-dependencies.js'
import ShopifyStacktraceyPlugin from '../../../bin/bundling/esbuild-plugin-stacktracey.js'
import ShopifyVSCodePlugin from '../../../bin/bundling/esbuild-plugin-vscode.js'
import {build as esBuild} from 'esbuild'
import requireResolvePlugin from '@chialab/esbuild-plugin-require-resolve'
import {copy} from 'esbuild-plugin-copy'
import glob from 'fast-glob'

const external = [
  // react-devtools-core is a dev dependency, no need to bundle it but throws errors if not included here.
  'react-devtools-core',
  // esbuild can't be bundled per design
  'esbuild',
  'postcss-load-config',
  'vite',
]

// yoga wasm file is not bundled by esbuild, so we need to copy it manually
const yogafile = glob.sync('../../node_modules/.pnpm/**/yoga.wasm')[0]

esBuild({
  bundle: true,
  entryPoints: ['./src/**/*.ts'],
  outdir: './dist',
  platform: 'node',
  format: 'esm',
  define: {
    // Necessary for theme-check-node to work
    'process.env.WEBPACK_MODE': 'true',
  },
  inject: ['../../bin/bundling/cjs-shims.js'],
  external,
  loader: {'.node': 'copy'},
  splitting: true,
  plugins: [
    ShopifyVSCodePlugin,
    ShopifyStacktraceyPlugin,
    // To allow using require.resolve in esbuild (we use it for graphiql)
    requireResolvePlugin(),
    copy({
      // this is equal to process.cwd(), which means we use cwd path as base path to resolve `to` path
      // if not specified, this plugin uses ESBuild.build outdir/outfile options as base path.
      resolveFrom: 'cwd',
      assets: [
        {
          from: ['../app/assets/**/*'],
          to: ['./dist/assets'],
        },
        {
          from: ['../app/templates/**/*'],
          to: ['./dist/templates'],
        },
        {
          from: ['./assets/*'],
          to: ['./dist/assets'],
        },
        {
          from: ['../cli-kit/assets/**/*'],
          to: ['./dist/assets'],
        },
        {
          from: [yogafile],
          to: ['./dist/'],
        },
        {
          from: ['../../node_modules/.pnpm/node_modules/@shopify/theme-check-node/configs/*.yml'],
          to: ['./dist/configs/'],
        },
      ],
    }),
  ],
})

cleanBundledDependencies(external)
