/* eslint-disable no-console */
import {getConfigs} from './configs'
import {BuildFailure, BuildResult, formatMessagesSync} from 'esbuild'
import {InlineConfig, build as viteBuild} from 'vite'
import {promises} from 'node:fs'
import {join} from 'node:path'

export interface Options {
  mode: 'development' | 'production'
}

export async function build({mode}: Options) {
  const isDevelopment = mode === 'development'
  const configs = getConfigs()
  const {
    development: {entries, build = {}, develop = {}, buildDir},
  } = configs

  const viteConfiguration: InlineConfig = {
    root: process.cwd(),
    // logLevel: isDevelopment ? 'silent' : 'info',
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
  try {
    if (isDevelopment) {
      // TODO
    } else {
      Object.entries(entries).map(async (entry) => {
        await promises.rmdir(join(process.cwd(), buildDir), {recursive: true})
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
      })
      logResult(null)
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (_error) {
    console.error('Error building extension: ', _error)
    process.exit(1)
  }
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
