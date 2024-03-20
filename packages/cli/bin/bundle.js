import {build as esBuild} from 'esbuild'
import cleanBundledDependencies from '../../../bin/bundling/clean-bundled-dependencies.js'
import CustomStacktraceyPlugin from '../../../bin/bundling/esbuild-plugin-stacktracey.js'
import requireResolvePlugin from '@chialab/esbuild-plugin-require-resolve'
import { copy } from 'esbuild-plugin-copy'
import glob from 'fast-glob'

const external = [
  'react-devtools-core',  // react-devtools-core is a dev dependency, no need to bundle it but throws errors if not included here.
  'esbuild', // esbuild can't be bundled per design
  'vscode-json-languageservice' // Errors because of a bad import/export design (maybe fixable via plugin?)
]

// yoga wasm file is not bundled by esbuild, so we need to copy it manually
const yogafile = glob.sync('../../node_modules/.pnpm/**/yoga.wasm')[0]

await esBuild({
  bundle: true,
  entryPoints: ['./src/**/*.ts'],
  outdir: './dist',
  platform: 'node',
  format: 'esm',
  inject: ['../../bin/bundling/cjs-shims.js'],
  external,
  loader: {'.node': 'copy'},
  splitting: true,
  plugins: [
    CustomStacktraceyPlugin(),
    requireResolvePlugin(), // To allow using require.resolve in esbuild
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
        }
      ]
    }),
  ],
})

await cleanBundledDependencies(external)



