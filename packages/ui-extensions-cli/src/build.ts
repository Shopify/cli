/* eslint-disable no-console */
import {getConfigs} from './configs'
import {build as esBuild, BuildFailure, BuildResult, formatMessages} from 'esbuild'

export interface Options {
  mode: 'development' | 'production'
}

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

  let built = false

  if (isDevelopment) {
    await onRebuild()
  }

  esBuild({
    bundle: true,
    define,
    entryPoints: entries,
    loader: {
      '.esnext': 'ts',
      '.js': 'jsx',
    },
    logLevel: isDevelopment ? 'silent' : 'info',
    legalComments: 'none',
    minify: !isDevelopment,
    outdir: buildDir,
    plugins: getPlugins(),
    target: 'es6',
    resolveExtensions: ['.tsx', '.ts', '.js', '.json', '.esnext', '.mjs', '.ejs'],
    watch: isDevelopment,
  })
    .then((result) => {
      if (built) {
        return
      }
      built = true
      return logResult(result)
    })
    .catch((_e) => {
      console.error('Error building extension: ', _e)
      process.exit(1)
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

async function onRebuild(failure: BuildFailure | undefined = undefined, _result: BuildResult | undefined = undefined) {
  if (failure) {
    console.error(failure.message)
  }
  await logResult(failure)
}

async function logResult(result: BuildResult | undefined) {
  if (result?.errors.length || result?.warnings.length) {
    await logErrors(result)
    return
  }
  console.log(`Build succeeded`)
}

async function logErrors(result: BuildResult) {
  const errors = await formatMessages(result.errors, {kind: 'error'})
  const warnings = await formatMessages(result.warnings, {kind: 'warning'})
  if (errors.length > 0) console.error(errors.join('\n'))
  if (warnings.length > 0) console.error(errors.join('\n'))
}
