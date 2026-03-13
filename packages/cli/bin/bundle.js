/* eslint-disable @shopify/cli/specific-imports-in-bootstrap-code, @nx/enforce-module-boundaries */
import {createRequire} from 'module'

import {build as esBuild} from 'esbuild'
import {copy} from 'esbuild-plugin-copy'
import glob from 'fast-glob'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'

import ShopifyStacktraceyPlugin from '../../../bin/bundling/esbuild-plugin-stacktracey.js'
import ShopifyVSCodePlugin from '../../../bin/bundling/esbuild-plugin-vscode.js'
import GraphiQLImportsPlugin from '../../../bin/bundling/esbuild-plugin-graphiql-imports.js'
import CliKitDedupPlugin from '../../../bin/bundling/esbuild-plugin-dedup-cli-kit.js'

const require = createRequire(import.meta.url)

const external = [
  // react-devtools-core is a dev dependency, no need to bundle it but throws errors if not included here.
  'react-devtools-core',
  // esbuild can't be bundled per design
  'esbuild',
  'lightningcss',
  // These two are binary dependencies from Hydrogen that can't be bundled
  '@ast-grep/napi',
  // prettier is ~4MB and only used in one place for formatting generated types.
  // It's externalized to avoid bundling — will use dynamic import at runtime.
  'prettier',
  // ts-morph + typescript are ~19MB. Used by Hydrogen for JS/TS transpilation.
  // Already lazily loaded via dynamic import, safe to externalize.
  'ts-morph',
  // typescript compiler (~9MB) is pulled in by @ts-morph/common and json-schema-to-typescript.
  // It's available at runtime since it's a project dependency.
  'typescript',
  // polaris + polaris-icons are ~2.1MB, only used for GraphiQL HTML template rendering.
  // Available at runtime as dependencies.
  '@shopify/polaris',
  '@shopify/polaris-icons',
  '@shopify/polaris-tokens',
  // react-dom (~1.3MB) only used for GraphiQL template server-side rendering.
  // ink uses its own react-reconciler, not react-dom.
  'react-dom',
  // @oclif/table pulls in ink@5 + react@18 + react-reconciler@0.29.2 (~1.8MB).
  // Externalizing it avoids duplicate react ecosystem.
  '@oclif/table',
  // lodash (~700KB input). Available as a runtime dependency.
  'lodash',
  // @opentelemetry packages (~1.3MB input). Available as runtime dependencies.
  '@opentelemetry/api',
  '@opentelemetry/core',
  '@opentelemetry/exporter-metrics-otlp-http',
  '@opentelemetry/otlp-transformer',
  '@opentelemetry/resources',
  '@opentelemetry/sdk-metrics',
  '@opentelemetry/semantic-conventions',

  // vscode language services are ~2MB, used by theme language server.
  // Available as transitive dependencies at runtime.
  'vscode-css-languageservice',
  'vscode-json-languageservice',
  'vscode-languageserver',
  'vscode-languageserver-protocol',
  'vscode-languageserver-textdocument',
  'vscode-languageserver-types',
  'vscode-uri',
  // Theme language server / check packages. Available as transitive deps.
  '@shopify/theme-check-common',
  '@shopify/theme-check-node',
  '@shopify/theme-check-docs-updater',
  '@shopify/theme-language-server-common',
  '@shopify/theme-language-server-node',
  // ohm-js (~389KB), used by liquid-html-parser for theme checks
  'ohm-js',
  '@shopify/liquid-html-parser',
  // @vscode/web-custom-data (~321KB), data files for language services
  '@vscode/web-custom-data',
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
  entryPoints: ['./src/**/*.ts'],
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
  sourcemap: false,
  loader: {'.node': 'copy'},
  splitting: true,
  // these tree shaking and minify options remove any in-source tests from the bundle
  treeShaking: true,
  minifyWhitespace: true,
  minifySyntax: true,
  minifyIdentifiers: true,

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
