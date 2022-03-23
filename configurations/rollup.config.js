import esbuild from 'rollup-plugin-esbuild'
import resolve from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'
import path from 'pathe'
import stripShebang from 'rollup-plugin-strip-shebang'
import commonjs from '@rollup/plugin-commonjs'
import alias from '@rollup/plugin-alias'

export const distDir = (packagePath) => {
  return process.env.SHOPIFY_DIST_DIR || path.join(packagePath, 'dist')
}

export const plugins = (packagePath, additionalAliases = []) => {
  return [
    json(),
    alias({
      // Including these transitive dependencies is necessary to prevent
      // runtime errors when the dependent packages try to import them.
      entries: additionalAliases,
    }),
    stripShebang(),
    resolve({
      preferBuiltins: true,
    }),
    esbuild({
      target: 'ES2020',
      tsconfig: path.join(packagePath, 'tsconfig.json'),
    }),
    commonjs({
      include: [/node_modules/],
    }),
  ]
}

export const external = [
  '@oclif/core',
  '@bugsnag/js',
  /**
   * Keytar contains some native code that leads to issues with Rollup.
   * Because of that we make it an external dependency of @shopify/cli-kit
   */
  'keytar',
  /**
   * Open has transitive dependencies that use __dirname from ES modules causing
   * runtime errors. Because of that we keep it as an external dependency until
   * they fix it on their end.
   */
  'open',
]
