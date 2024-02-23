import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {AppInterface} from '../../models/app/app.js'
import {EsbuildEnvVarRegex} from '../../constants.js'
import {hyphenate, camelize} from '@shopify/cli-kit/common/string'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {exec} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import {build as esBuild, BuildResult, BuildOptions} from 'esbuild'
import {findPathUp, inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {renderTasks} from '@shopify/cli-kit/node/ui'
import {pickBy} from '@shopify/cli-kit/common/object'
import {runWithTimer} from '@shopify/cli-kit/node/metadata'
import {Writable} from 'stream'

interface JSFunctionBuildOptions {
  stdout: Writable
  stderr: Writable
  signal?: AbortSignal
  app: AppInterface
  // we want to use tasks when this is a primary command, i.e. 'shopify app function build',
  // but we don't want the fancy UI when this is running as part of 'shopify app build'.
  useTasks?: boolean
}

export async function buildJSFunction(fun: ExtensionInstance<FunctionConfigType>, options: JSFunctionBuildOptions) {
  const exports = jsExports(fun)
  const javyBuilder: JavyBuilder = exports.length === 0 ? DefaultJavyBuilder : new ExportJavyBuilder(exports)

  if (options.useTasks) {
    return buildJSFunctionWithTasks(fun, options, javyBuilder)
  } else {
    return buildJSFunctionWithoutTasks(fun, options, javyBuilder)
  }
}

async function buildJSFunctionWithoutTasks(
  fun: ExtensionInstance<FunctionConfigType>,
  options: JSFunctionBuildOptions,
  builder: JavyBuilder,
) {
  if (!options.signal?.aborted) {
    options.stdout.write(`Building function ${fun.localIdentifier}...`)
    options.stdout.write(`Building GraphQL types...\n`)
    await buildGraphqlTypes(fun, options)
  }
  if (!options.signal?.aborted) {
    options.stdout.write(`Bundling JS function...\n`)
    await builder.bundle(fun, options)
  }
  if (!options.signal?.aborted) {
    options.stdout.write(`Running javy...\n`)
    await builder.compile(fun, options)
  }
  if (!options.signal?.aborted) {
    options.stdout.write(`Done!\n`)
  }
}

export async function buildJSFunctionWithTasks(
  fun: ExtensionInstance<FunctionConfigType>,
  options: JSFunctionBuildOptions,
  builder: JavyBuilder,
) {
  await renderTasks([
    {
      title: 'Building GraphQL types',
      task: async () => {
        await buildGraphqlTypes(fun, options)
      },
    },
    {
      title: 'Bundling JS function',
      task: async () => {
        await builder.bundle(fun, options)
      },
    },
    {
      title: 'Running javy',
      task: async () => {
        await builder.compile(fun, options)
      },
    },
  ])
}

export async function buildGraphqlTypes(
  fun: {directory: string; isJavaScript: boolean},
  options: JSFunctionBuildOptions,
) {
  if (!fun.isJavaScript) {
    throw new Error('GraphQL types can only be built for JavaScript functions')
  }

  return runWithTimer('cmd_all_timing_network_ms')(async () => {
    return exec('npm', ['exec', '--', 'graphql-code-generator', '--config', 'package.json'], {
      cwd: fun.directory,
      stderr: options.stderr,
      signal: options.signal,
    })
  })
}

export async function bundleExtension(
  fun: ExtensionInstance<FunctionConfigType>,
  options: JSFunctionBuildOptions,
  processEnv = process.env,
) {
  const entryPoint = await findPathUp('node_modules/@shopify/shopify_function/index.ts', {
    type: 'file',
    cwd: fun.directory,
  })
  if (!entryPoint) {
    throw new Error(
      "Could not find the Shopify Function runtime. Make sure you have '@shopify/shopify_function' installed",
    )
  }
  if (!fun.entrySourceFilePath) {
    throw new Error('Could not find your function entry point. It must be in src/index.js or src/index.ts')
  }

  const esbuildOptions = {
    ...getESBuildOptions(fun.directory, fun.entrySourceFilePath, options.app.dotenv?.variables ?? {}, processEnv),
    entryPoints: [entryPoint],
  }

  return esBuild(esbuildOptions)
}

function getESBuildOptions(
  directory: string,
  userFunction: string,
  appEnv: {[variable: string]: string | undefined},
  processEnv = process.env,
): Parameters<typeof esBuild>[0] {
  const validEnvs = pickBy(processEnv, (value, key) => EsbuildEnvVarRegex.test(key) && value)

  const env: {[variable: string]: string | undefined} = {...appEnv, ...validEnvs}
  const define = Object.keys(env || {}).reduce(
    (acc, key) => ({
      ...acc,
      [`process.env.${key}`]: JSON.stringify(env[key]),
    }),
    {},
  )

  const esbuildOptions: Parameters<typeof esBuild>[0] = {
    outfile: joinPath(directory, 'dist/function.js'),
    alias: {
      'user-function': userFunction,
    },
    define,
    logLevel: 'silent',
    bundle: true,
    legalComments: 'none',
    target: 'es2022',
    format: 'esm',
  }
  return esbuildOptions
}

export async function runJavy(
  fun: ExtensionInstance<FunctionConfigType>,
  options: JSFunctionBuildOptions,
  extra: string[] = [],
) {
  const args = ['exec', '--', 'javy-cli', 'compile', '-d', '-o', fun.outputPath, 'dist/function.js', ...extra]

  return exec('npm', args, {
    cwd: fun.directory,
    stdout: 'inherit',
    stderr: 'inherit',
    signal: options.signal,
  })
}

export async function installJavy(app: AppInterface) {
  const javyRequired = app.allExtensions.some((ext) => ext.features.includes('function') && ext.isJavaScript)
  if (javyRequired) {
    await exec('npm', ['exec', '--', 'javy-cli', '--version'], {cwd: app.directory})
  }
}

interface FunctionRunnerOptions {
  input?: string
  json: boolean
  export?: string
}

export async function runFunctionRunner(fun: ExtensionInstance<FunctionConfigType>, options: FunctionRunnerOptions) {
  const outputAsJson = options.json ? ['--json'] : []
  const withInput = options.input ? ['--input', options.input] : []
  const exportName = options.export ? ['--export', options.export] : []
  return exec(
    'npm',
    ['exec', '--', 'function-runner', '-f', fun.outputPath, ...withInput, ...outputAsJson, ...exportName],
    {
      cwd: fun.directory,
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    },
  )
}

export interface JavyBuilder {
  bundle(
    fun: ExtensionInstance<FunctionConfigType>,
    options: JSFunctionBuildOptions,
  ): Promise<BuildResult<BuildOptions>>
  compile(fun: ExtensionInstance<FunctionConfigType>, options: JSFunctionBuildOptions): Promise<void>
}

export const DefaultJavyBuilder: JavyBuilder = {
  async bundle(fun: ExtensionInstance<FunctionConfigType>, options: JSFunctionBuildOptions) {
    return bundleExtension(fun, options)
  },

  async compile(fun: ExtensionInstance<FunctionConfigType>, options: JSFunctionBuildOptions) {
    return runJavy(fun, options)
  },
}

const JAVY_WORLD = 'shopify-function'
export class ExportJavyBuilder implements JavyBuilder {
  exports: string[]

  constructor(exports: string[]) {
    this.exports = exports
  }

  async bundle(fun: ExtensionInstance<FunctionConfigType>, options: JSFunctionBuildOptions, processEnv = process.env) {
    if (!fun.entrySourceFilePath) {
      throw new Error('Could not find your function entry point. It must be in src/index.js or src/index.ts')
    }

    const contents = this.entrypointContents
    outputDebug('Generating dist/function.js using generated module:')
    outputDebug(contents)

    const esbuildOptions: Parameters<typeof esBuild>[0] = {
      ...getESBuildOptions(fun.directory, fun.entrySourceFilePath, options.app.dotenv?.variables ?? {}, processEnv),
      stdin: {
        contents,
        loader: 'ts',
        resolveDir: fun.directory,
      },
    }
    return esBuild(esbuildOptions)
  }

  async compile(fun: ExtensionInstance<FunctionConfigType>, options: JSFunctionBuildOptions) {
    const witContent = this.wit
    outputDebug('Generating world to use with Javy:')
    outputDebug(witContent)

    return inTemporaryDirectory(async (dir) => {
      const witPath = joinPath(dir, 'javy-world.wit')
      await writeFile(witPath, witContent)

      return runJavy(fun, options, ['--wit', witPath, '-n', JAVY_WORLD])
    })
  }

  get wit() {
    // % escapes the name to avoid conflict with reserved words, if any
    const witExports = this.exports.map((name) => `export %${hyphenate(name)}: func();`)
    return `package function:impl;

world ${JAVY_WORLD} {
  ${witExports.join('\n  ')}
}`
  }

  get entrypointContents() {
    const prelude = `
import __runFunction from "@shopify/shopify_function/run"`

    const exports = this.exports.map((name) => {
      const identifier = camelize(name)
      const alias = camelize(`run-${name}`)
      return `
import { ${identifier} as ${alias} } from "user-function"
export function ${identifier}() { return __runFunction(${alias}) }`
    })

    return `${prelude}\n${exports.join('\n')}`
  }
}

export function jsExports(fun: ExtensionInstance<FunctionConfigType>) {
  const targets = fun.configuration.targeting || []
  const withoutExport = targets.filter((target) => !target.export)
  const withExport = targets.filter((target) => Boolean(target.export))

  if (targets.length > 1 && withoutExport.length > 0) {
    throw new Error(`Can't infer export name for targets:
${withoutExport.map(({target}) => `- '${target}'`).join('\n')}
All targets must have an export when multiple targets are present.`)
  }

  const withInvalidExportName = withExport.filter((target) => !target.export!.match(/^[a-z0-9-]+$/))
  if (withInvalidExportName.length > 0) {
    const message = []
    const invalidExportNames = withInvalidExportName.map((target) => `'${target.export!}'`)
    message.push(`Invalid export names: ${invalidExportNames.join(', ')}.

The TOML's exports must be kebab-case (lowercase, hyphen or numbers) to comply with WebAssembly's Component Model.

JavaScript exports with camelCase names are automatically mapped to kebab-case Wasm exports.\n`)
    message.push('Suggested TOML changes:')
    withInvalidExportName.forEach((target) => {
      const name = target.export!
      message.push(`- Change export for '${target.target}' to '${hyphenate(name)}'.`)
    })
    throw new Error(message.join('\n'))
  }

  return withExport.map((target) => target.export!)
}
