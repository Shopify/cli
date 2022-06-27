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

export const aliases = (packagePath) => {
  return [
    {find: '@shopify/cli-testing', replacement: path.join(packagePath, '../cli-testing/src/index.ts')},
    {find: /@shopify\/cli-kit\/(.+)/, replacement: path.join(packagePath, '../cli-kit/src/$1.ts')},
    {find: '@shopify/cli-kit', replacement: path.join(packagePath, '../cli-kit/src/index.ts')},
  ]
}

export const plugins = (packagePath) => {
  return [
    json(),
    alias({
      // Including these transitive dependencies is necessary to prevent
      // runtime errors when the dependent packages try to import them.
      entries: aliases(packagePath),
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

export const external = ['@oclif/core', '@bugsnag/js', /@shopify\/cli-kit\/?.*/]
