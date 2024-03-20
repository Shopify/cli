import {build as esBuild} from 'esbuild'
import cleanBundledDependencies from '../../../bin/clean-bundled-dependencies.js'
import requireResolvePlugin from '@chialab/esbuild-plugin-require-resolve';
import { copy } from 'esbuild-plugin-copy';
import { readFile } from 'fs/promises';
import glob from 'fast-glob'

const external = [
  'react-devtools-core',  // react-devtools-core is a dev dependency, no need to bundle it.
  // 'yoga-wasm-web', // yoga-wasm-web can't be bundled because it's a wasm file (maybe fixable via plugin?)
  'esbuild', // esbuild can't be bundled per design
  'vscode-json-languageservice' // Errors because of a bad import/export design (maybe fixable via plugin?)
]

/**
 * Custom plugin to solve some issues with specific dependencies.
 */
function ShopifyESBuildPlugin ({greeting = "world"} = {}) {
  return {
      name: "ShopifyESBuildPlugin",
      setup(build) {

        // Stacktracey has a custom require implementation that doesn't work with esbuild
        build.onLoad({ filter: /.*stacktracey\.js/ }, async (args) => {
          const contents = await readFile(args.path, 'utf8')
          return { contents: contents.replaceAll('nodeRequire (', 'module.require(') }
        })
      }
  }
}

console.log("SEARCHING FOR YOGA.WASM")
// yoga wasm file is not bundled by esbuild, so we need to copy it manually
const yogafile = glob.sync('./node_modules/**/yoga.wasm')[0]
console.log(yogafile)

await esBuild({
  bundle: true,
  entryPoints: ['./src/**/*.ts'],
  outdir: './dist',
  platform: 'node',
  format: 'esm',
  inject: ['../../bin/cjs-shims.js'],
  external,
  loader: {'.node': 'copy'},
  splitting: true,
  plugins: [
    ShopifyESBuildPlugin(),
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



