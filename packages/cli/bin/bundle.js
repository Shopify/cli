import {build as esBuild} from 'esbuild'
import cleanBundledDependencies from '../../../bin/clean-bundled-dependencies.js'
import requireResolvePlugin from '@chialab/esbuild-plugin-require-resolve';
import { readFile } from 'fs/promises';

const external = [
  'react-devtools-core',  // react-devtools-core is a dev dependency, no need to bundle it.
  'yoga-wasm-web', // yoga-wasm-web can't be bundled because it's a wasm file (maybe fixable via plugin?)
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
    requireResolvePlugin() // To allow using require.resolve in esbuild
  ],
})

await cleanBundledDependencies(external)



