/* eslint-disable @shopify/cli/specific-imports-in-bootstrap-code, @nx/enforce-module-boundaries */
import ShopifyStacktraceyPlugin from '../../../bin/bundling/esbuild-plugin-stacktracey.js'
import ShopifyVSCodePlugin from '../../../bin/bundling/esbuild-plugin-vscode.js'
import GraphiQLImportsPlugin from '../../../bin/bundling/esbuild-plugin-graphiql-imports.js'
import CliKitDedupPlugin from '../../../bin/bundling/esbuild-plugin-dedup-cli-kit.js'
import {build as esBuild} from 'esbuild'
import {copy} from 'esbuild-plugin-copy'
import glob from 'fast-glob'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)

const external = [
  // react-devtools-core is a dev dependency, no need to bundle it but throws errors if not included here.
  'react-devtools-core',
  // esbuild can't be bundled per design
  'esbuild',
  'lightningcss',
  // These two are binary dependencies from Hydrogen that can't be bundled
  '@ast-grep/napi',
]

// yoga wasm file is not bundled by esbuild, so we need to copy it manually
const yogafile = glob.sync('../../node_modules/.pnpm/**/yoga.wasm')[0]

const wasmTomlPatchFile = glob.sync('../../node_modules/.pnpm/**/toml_patch_bg.wasm')[0]

// Find theme-check-node's config yml files
const themePath = require.resolve('@shopify/theme-check-node')
const configYmlPath = joinPath(themePath, '..', '..', 'configs/*.yml')

const themeUpdaterPath = require.resolve('@shopify/theme-check-docs-updater')
const themeUpdaterDataPath = joinPath(themeUpdaterPath, '..', '..', 'data/*')

const hydrogenPath = dirname(require.resolve('@shopify/cli-hydrogen/package.json'))
const hydrogenAssets = joinPath(hydrogenPath, 'dist/assets/hydrogen/**/*')

esBuild({
  bundle: true,
  entryPoints: ['./src/index.ts'],
  outdir: './dist',
  platform: 'node',
  format: 'esm',
  define: {
    // Necessary for theme-check-node to work
    'process.env.WEBPACK_MODE': 'true',
    'import.meta.vitest': 'false',
    // Injected during build to detect fork vs original repo
    'process.env.SHOPIFY_CLI_BUILD_REPO': JSON.stringify(process.env.SHOPIFY_CLI_BUILD_REPO || 'unknown'),
  },
  inject: ['../../bin/bundling/cjs-shims.js'],
  external,
  sourcemap: true,
  loader: {'.node': 'copy'},
  splitting: true,
  // these tree shaking and minify options remove any in-source tests from the bundle
  treeShaking: true,
  minifyWhitespace: false,
  minifySyntax: true,
  minifyIdentifiers: false,

  plugins: [
    ShopifyVSCodePlugin,
    GraphiQLImportsPlugin,
    ShopifyStacktraceyPlugin,
    CliKitDedupPlugin({require}),
    copy({
      // this is equal to process.cwd(), which means we use cwd path as base path to resolve `to` path
      // if not specified, this plugin uses ESBuild.build outdir/outfile options as base path.
      resolveFrom: 'cwd',
      globbyOptions: {dot: true},
      assets: [
        {
          from: ['../app/assets/**/*'],
          to: ['./dist/assets'],
        },
        {
          from: ['../theme/assets/**/*'],
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
          from: [wasmTomlPatchFile],
          to: ['./dist/'],
        },
        {
          from: [configYmlPath],
          to: ['./dist/configs/'],
        },
        {
          from: [themeUpdaterDataPath],
          to: ['./dist/data/'],
        },
        {
          from: [hydrogenAssets],
          to: ['./dist/assets/hydrogen'],
        },
      ],
    }),
  ],
})
