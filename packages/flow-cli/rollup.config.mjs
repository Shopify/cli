import {nodeResolve} from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import alias from '@rollup/plugin-alias'
import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Fix from the Shopify CLI bundler: StackTracey uses a variable called
// `nodeRequire` (assigned to the bundler's sentinel) to avoid tree-shaking.
// Rewrite it to module.require() so it calls the real Node.js require.
const stacktraceyPlugin = {
  name: 'fix-stacktracey',
  transform(code, id) {
    if (id.includes('stacktracey')) {
      return {code: code.replaceAll('nodeRequire (', 'require(')}
    }
  },
}

export default {
  input: 'dist/main.js',
  output: {
    file: 'flow.mjs',
    format: 'esm',
    inlineDynamicImports: true,
    // Fix from the Shopify CLI bundler: inject CJS shims so __dirname,
    // __filename, and require are available to bundled CJS modules.
    banner: [
      "import { createRequire as __cjsRequire } from 'module';",
      "import { fileURLToPath as __fup } from 'url';",
      "import { dirname as __dn } from 'path';",
      'const require = __cjsRequire(import.meta.url);',
      'const __filename = __fup(import.meta.url);',
      'const __dirname = __dn(__filename);',
    ].join('\n'),
  },
  external: [/^node:/, 'fs', 'fs/promises', 'path', 'os', 'url', 'module', 'stream', 'events',
    'crypto', 'http', 'https', 'net', 'tty', 'util', 'child_process', 'worker_threads',
    'readline', 'buffer', 'string_decoder', 'assert', 'perf_hooks', 'v8', 'vm', 'zlib',
    'timers', 'timers/promises'],
  plugins: [
    alias({
      entries: [
        {find: 'react-devtools-core', replacement: resolve(__dirname, 'src/stubs/react-devtools-core.mjs')},
        {find: '@shopify/toml-patch', replacement: resolve(__dirname, 'src/stubs/toml-patch.cjs')},
      ],
    }),
    json(),
    nodeResolve({preferBuiltins: true, exportConditions: ['node', 'import', 'require', 'default']}),
    commonjs({transformMixedEsModules: true, ignoreDynamicRequires: true}),
    stacktraceyPlugin,
  ],
  onwarn(warning, warn) {
    if (warning.code === 'CIRCULAR_DEPENDENCY') return
    if (warning.code === 'THIS_IS_UNDEFINED') return
    warn(warning)
  },
}
