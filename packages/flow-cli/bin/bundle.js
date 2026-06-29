import {build} from 'esbuild'
import {copy} from 'esbuild-plugin-copy'
import glob from 'fast-glob'
import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'
import ShopifyStacktraceyPlugin from '../../../bin/bundling/esbuild-plugin-stacktracey.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')

const wasmTomlPatchFile = glob.sync(`${repoRoot}/node_modules/.pnpm/**/toml_patch_bg.wasm`)[0]

await build({
  bundle: true,
  entryPoints: [{in: './src/main.ts', out: 'main'}],
  outdir: './bundle',
  platform: 'node',
  format: 'esm',
  splitting: true,
  treeShaking: true,
  minifyWhitespace: true,
  minifySyntax: true,
  minifyIdentifiers: true,
  inject: [resolve(repoRoot, 'bin/bundling/cjs-shims.js')],
  external: ['react-devtools-core'],
  plugins: [
    ShopifyStacktraceyPlugin,
    copy({
      resolveFrom: 'cwd',
      assets: [{from: [wasmTomlPatchFile], to: ['./bundle/']}],
    }),
  ],
})
