import {build as esBuild} from 'esbuild'
import cleanBundledDependencies from '../../../bin/clean-bundled-dependencies.js'
import requireResolvePlugin from '@chialab/esbuild-plugin-require-resolve';

const external = [
  'react-devtools-core',  // react-devtools-core can't be bundled (part of ink)
  'yoga-wasm-web', // yoga-wasm-web can't be bundled (part of ink)
  'esbuild',
  '@luckycatfactory/esbuild-graphql-loader',
  'vscode-json-languageservice'
]

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
    requireResolvePlugin(), // To allow using require.resolve in esbuild
    myPlugin()
  ],
})

await cleanBundledDependencies(external)



function myPlugin ({greeting = "world"} = {}) {
  return {
      name: "MyPlugin",
      setup(build) {
        build.onResolve({ filter: /stacktracey\.js$/ }, (args) => {
          return {
              path: args.path,
              namespace: 'vanilla'
          }
        })

        build.onLoad({ filter: /.*/, namespace: "vanilla" }, async (args) => {
          const contents = await readFile(args.path, 'utf8')
          return {
              // a simple substitution just to prove that we've
              // loaded the file and are transforming it
              contents: contents.replace('nodeRequire(', 'module.require(')
          }
        })
      }
  }
}
