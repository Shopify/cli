/* eslint-disable no-console */
import {getConfigs} from './configs'

import {BuildFailure, BuildResult, formatMessagesSync} from 'esbuild'
import {InlineConfig, build as viteBuild, createServer as createViteServer} from 'vite'
import graphqlPlugin from 'vite-plugin-graphql'
import {promises} from 'node:fs'
// eslint-disable-next-line no-restricted-imports
import {join} from 'node:path'

export interface Options {
  mode: 'development' | 'production'
}

// https://github.com/Shopify/cli/blob/main/packages/ui-extensions-cli/src/build.ts

export async function build({mode}: Options) {
  const isDevelopment = mode === 'development'
  const configs = getConfigs()
  const {
    development: {entries, build = {}, develop = {}, buildDir},
  } = configs

  const {env = {}} = isDevelopment ? develop : build
  const define = Object.keys(env || {}).reduce(
    (acc, key) => ({
      ...acc,
      [`process.env.${key}`]: JSON.stringify(env[key]),
    }),
    {'process.env.NODE_ENV': JSON.stringify(mode)},
  )

  /**
   * 1. How to write changes to disk when modules change?
   * 2. How to make the output bundle compatible with web workers
   */
  const viteConfiguration: InlineConfig = {
    root: process.cwd(),
    logLevel: isDevelopment ? 'silent' : 'info',
    define,
    plugins: [graphqlPlugin as any],
    build: {
      minify: !isDevelopment,
      outDir: buildDir,
      target: 'es6',
    },
    esbuild: {
      legalComments: 'none',
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.json', '.esnext', '.mjs', '.ejs'],
    },
  }

  function onRebuild(failure: BuildFailure | null, _result: BuildResult | null) {
    if (failure) {
      console.error(failure.message)
    }
    logResult(failure)
  }

  try {
    if (isDevelopment) {
      await buildExtensions(entries, buildDir, viteConfiguration)
      const server = await createViteServer({
        ...viteConfiguration,
        plugins: [
          ...(viteConfiguration.plugins ?? []),
          {
            name: 'ui-extensions',
            watchChange: (id, change) => {
              console.error(id)
            },
          },
        ],
      })
    } else {
      await buildExtensions(entries, buildDir, viteConfiguration)
      logResult(null)
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (_error) {
    console.error('Error building extension: ', _error)
    process.exit(1)
  }
}

async function buildExtensions(entries: {[key: string]: string}, buildDir: string, viteConfiguration: InlineConfig) {
  await Promise.all(
    Object.entries(entries).map(async (entry) => {
      await buildExtension(buildDir, viteConfiguration, entry)
    }),
  )
}

async function buildExtension(buildDir: string, viteConfiguration: InlineConfig, entry: [string, string]) {
  await promises.rm(join(process.cwd(), buildDir), {recursive: true})
  await viteBuild({
    ...viteConfiguration,
    build: {
      ...viteConfiguration.build,
      lib: {
        name: 'ui-extension',
        formats: ['es'],
        fileName: (_) => `${entry[0]}.js`,
        entry: entry[1],
      },
    },
  })
}

function getPlugins() {
  const plugins = []

  if (graphqlAvailable()) {
    const {default: graphqlLoader} = require('@luckycatfactory/esbuild-graphql-loader')
    plugins.push(graphqlLoader())
  }

  return plugins
}

function graphqlAvailable() {
  try {
    // eslint-disable-next-line @babel/no-unused-expressions
    require.resolve('graphql') && require.resolve('graphql-tag')
    return true
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

function onRebuild(failure: BuildFailure | null, _result: BuildResult | null) {
  if (failure) {
    console.error(failure.message)
  }
  logResult(failure)
}

function logResult(result: BuildResult | null) {
  if (result?.errors.length || result?.warnings.length) {
    logErrors(result)
    return
  }
  console.log(`Build succeeded`)
}

function logErrors(result: BuildResult) {
  const errors = formatMessagesSync(result.errors, {kind: 'error'})
  const warnings = formatMessagesSync(result.warnings, {kind: 'warning'})
  if (errors.length > 0) console.error(errors.join('\n'))
  if (warnings.length > 0) console.error(errors.join('\n'))
}
