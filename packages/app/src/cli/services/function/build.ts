/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  downloadBinary,
  javyBinary,
  javyPluginBinary,
  wasmOptBinary,
  deriveJavaScriptBinaryDependencies,
  BinaryDependencies,
  trampolineBinary,
  V2_TRAMPOLINE_VERSION,
  V1_TRAMPOLINE_VERSION,
} from './binaries.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {AppInterface} from '../../models/app/app.js'
import {EsbuildEnvVarRegex} from '../../constants.js'
import {hyphenate, camelize} from '@shopify/cli-kit/common/string'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'
import {exec} from '@shopify/cli-kit/node/system'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {build as esBuild, BuildResult} from 'esbuild'
import {findPathUp, inTemporaryDirectory, readFile, readFileSync, writeFile} from '@shopify/cli-kit/node/fs'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {renderTasks} from '@shopify/cli-kit/node/ui'
import {pickBy} from '@shopify/cli-kit/common/object'
import {runWithTimer} from '@shopify/cli-kit/node/metadata'
import {AbortError} from '@shopify/cli-kit/node/error'
import {generate} from '@graphql-codegen/cli'
import {Writable} from 'stream'

export const PREFERRED_FUNCTION_NPM_PACKAGE_MAJOR_VERSION = '2'

class InvalidShopifyFunctionPackageError extends AbortError {
  constructor(message: string) {
    super(
      message,
      outputContent`Make sure you have a compatible version of the ${outputToken.yellow(
        '@shopify/shopify_function',
      )} library installed.`,
      [
        outputContent`Add ${outputToken.green(
          `"@shopify/shopify_function": "~${PREFERRED_FUNCTION_NPM_PACKAGE_MAJOR_VERSION}.0.0"`,
        )} to the dependencies section of the package.json file in your function's directory, if not already present.`
          .value,
        `Run your package manager's install command to update dependencies.`,
      ],
    )
  }
}

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

  const deps = await validateShopifyFunctionPackageVersion(fun)

  if (options.useTasks) {
    return buildJSFunctionWithTasks(fun, options, javyBuilder, deps)
  } else {
    return buildJSFunctionWithoutTasks(fun, options, javyBuilder, deps)
  }
}

async function buildJSFunctionWithoutTasks(
  fun: ExtensionInstance<FunctionConfigType>,
  options: JSFunctionBuildOptions,
  builder: JavyBuilder,
  deps: BinaryDependencies,
) {
  if (!options.signal?.aborted) {
    options.stdout.write(`Building function ${fun.localIdentifier}...`)
    options.stdout.write(`Building GraphQL types...\n`)
    await buildGraphqlTypes(fun)
  }
  if (!options.signal?.aborted) {
    options.stdout.write(`Bundling JS function...\n`)
    await builder.bundle(fun, options)
  }
  if (!options.signal?.aborted) {
    options.stdout.write(`Running javy...\n`)
    await builder.compile(fun, options, deps)
  }
  if (!options.signal?.aborted) {
    options.stdout.write(`Done!\n`)
  }
}

async function buildJSFunctionWithTasks(
  fun: ExtensionInstance<FunctionConfigType>,
  options: JSFunctionBuildOptions,
  builder: JavyBuilder,
  deps: BinaryDependencies,
) {
  await renderTasks([
    {
      title: 'Building GraphQL types',
      task: async () => {
        await buildGraphqlTypes(fun)
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
        await builder.compile(fun, options, deps)
      },
    },
  ])
}

export async function buildGraphqlTypes(fun: {directory: string; isJavaScript: boolean}) {
  if (!fun.isJavaScript) {
    throw new Error('GraphQL types can only be built for JavaScript functions')
  }

  return runWithTimer('cmd_all_timing_network_ms')(async () => {
    const packageJsonPath = joinPath(fun.directory, 'package.json')
    const packageJson = JSON.parse(await readFile(packageJsonPath))

    if (!packageJson.codegen) {
      throw new AbortError('No `codegen` config found in package.json')
    }

    return generate({
      ...packageJson.codegen,
      cwd: fun.directory,
    })
  })
}

async function checkForShopifyFunctionRuntimeEntrypoint(fun: ExtensionInstance<FunctionConfigType>) {
  const entryPoint = await findPathUp('node_modules/@shopify/shopify_function/index.ts', {
    type: 'file',
    cwd: fun.directory,
  })

  const runModule = await findPathUp('node_modules/@shopify/shopify_function/run.ts', {
    type: 'file',
    cwd: fun.directory,
  })

  if (!entryPoint || !runModule) {
    throw new InvalidShopifyFunctionPackageError('Could not find the Shopify Functions JavaScript library.')
  }

  if (!fun.entrySourceFilePath) {
    throw new AbortError('Could not find your function entry point. It must be in src/index.js or src/index.ts')
  }

  return entryPoint
}

export async function validateShopifyFunctionPackageVersion(
  fun: ExtensionInstance<FunctionConfigType>,
): Promise<BinaryDependencies> {
  const packageJsonPath = await findPathUp('node_modules/@shopify/shopify_function/package.json', {
    type: 'file',
    cwd: fun.directory,
  })

  if (!packageJsonPath) {
    throw new InvalidShopifyFunctionPackageError('Could not find the Shopify Functions JavaScript library.')
  }

  const packageJson = JSON.parse(await readFile(packageJsonPath))
  const majorVersion = packageJson.version.split('.')[0]

  const derivedDeps = deriveJavaScriptBinaryDependencies(majorVersion)
  if (derivedDeps === null) {
    throw new InvalidShopifyFunctionPackageError(
      'The installed version of the Shopify Functions JavaScript library is not compatible with this version of Shopify CLI.',
    )
  }
  return derivedDeps
}

export async function bundleExtension(
  fun: ExtensionInstance<FunctionConfigType>,
  options: JSFunctionBuildOptions,
  processEnv = process.env,
) {
  const entryPoint = await checkForShopifyFunctionRuntimeEntrypoint(fun)

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

export async function runWasmOpt(modulePath: string) {
  const wasmOpt = wasmOptBinary()
  await downloadBinary(wasmOpt)

  const wasmOptDir = dirname(wasmOptBinary().path)

  const command = `node`
  const args = [
    // invoke the js-wrapped wasm-opt binary
    wasmOptBinary().name,
    modulePath,
    // pass these options to wasm-opt
    '-Oz',
    '--enable-bulk-memory',
    '--enable-multimemory',
    '--enable-nontrapping-float-to-int',
    '--strip-debug',
    // overwrite our existing module with the optimized version
    '-o',
    modulePath,
  ]

  outputDebug(`Wasm binary: ${wasmOptBinary().name}`)
  outputDebug('Optimizing this wasm binary using wasm-opt.')
  await exec(command, args, {cwd: wasmOptDir})
}

export async function runTrampoline(modulePath: string) {
  let trampolineVersion
  const importedModules = await importedWasmModules(modulePath)
  if (importedModules.includes('shopify_function_v1')) {
    trampolineVersion = V1_TRAMPOLINE_VERSION
  } else if (importedModules.includes('shopify_function_v2')) {
    trampolineVersion = V2_TRAMPOLINE_VERSION
  }

  if (!trampolineVersion) {
    return
  }

  const trampoline = trampolineBinary(trampolineVersion)
  await downloadBinary(trampoline)

  const command = trampoline.path

  const args = ['-i', modulePath, '-o', modulePath]
  outputDebug(`Applying trampoline to the wasm binary with command: ${command} ${args.join(' ')}`)
  await exec(command, args)
}

async function importedWasmModules(modulePath: string): Promise<string[]> {
  const moduleBytes = new Uint8Array(readFileSync(modulePath))
  const isValid = WebAssembly.validate(moduleBytes)
  if (!isValid) {
    return []
  }
  const module = new WebAssembly.Module(moduleBytes)
  const imports = WebAssembly.Module.imports(module)
  // Sets preserve insertion order so the returned array should be
  // deterministic when given the same Wasm module
  return [...new Set(imports.map((importItem) => importItem.module))]
}

export async function runJavy(
  fun: ExtensionInstance<FunctionConfigType>,
  options: JSFunctionBuildOptions,
  binaryDeps: BinaryDependencies,
  extra: string[] = [],
) {
  const javy = javyBinary(binaryDeps.javy)
  const plugin = javyPluginBinary(binaryDeps.javyPlugin)
  await Promise.all([downloadBinary(javy), downloadBinary(plugin)])

  // Using the `build` command we want to emit:
  //
  //    `javy build -C dynamic -C plugin=path/to/javy_quickjs_provider_v3.wasm -C wit=<path> -C wit-world=val -o <path> <function.js>`
  const args = [
    'build',
    '-C',
    'dynamic',
    '-C',
    `plugin=${plugin.path}`,
    ...extra,
    '-o',
    fun.outputPath,
    'dist/function.js',
  ]

  return exec(javy.path, args, {
    cwd: fun.directory,
    stdout: 'inherit',
    stderr: 'inherit',
    signal: options.signal,
  })
}

export async function installJavy(app: AppInterface) {
  const extensions = app.allExtensions.filter((ext) => ext.features.includes('function') && ext.isJavaScript)

  // Get the dependencies for each extension
  const depsPromises = extensions.map((ext) => {
    return validateShopifyFunctionPackageVersion(ext as ExtensionInstance<FunctionConfigType>)
  })
  const deps = await Promise.all(depsPromises)

  // Extract the javy and plugin dependencies
  const javyDeps = new Set<string>()
  const javyPluginDeps = new Set<string>()
  deps.forEach((dep) => {
    javyDeps.add(dep.javy)
    javyPluginDeps.add(dep.javyPlugin)
  })

  // Setup our download promises
  const downloadPromises: Promise<void>[] = []
  javyDeps.forEach((javyDepVersion) => {
    downloadPromises.push(downloadBinary(javyBinary(javyDepVersion)))
  })
  javyPluginDeps.forEach((javyPluginDepVersion) => {
    downloadPromises.push(downloadBinary(javyPluginBinary(javyPluginDepVersion)))
  })

  // Run all the downloads in parallel
  await Promise.all(downloadPromises)
}

interface JavyBuilder {
  bundle(fun: ExtensionInstance<FunctionConfigType>, options: JSFunctionBuildOptions): Promise<BuildResult>
  compile(
    fun: ExtensionInstance<FunctionConfigType>,
    options: JSFunctionBuildOptions,
    binaryDeps: BinaryDependencies,
  ): Promise<void>
}

const DefaultJavyBuilder: JavyBuilder = {
  async bundle(fun: ExtensionInstance<FunctionConfigType>, options: JSFunctionBuildOptions) {
    return bundleExtension(fun, options)
  },

  async compile(
    fun: ExtensionInstance<FunctionConfigType>,
    options: JSFunctionBuildOptions,
    binaryDeps: BinaryDependencies,
  ) {
    return runJavy(fun, options, binaryDeps)
  },
}

const JAVY_WORLD = 'shopify-function'
export class ExportJavyBuilder implements JavyBuilder {
  exports: string[]

  constructor(exports: string[]) {
    this.exports = exports
  }

  async bundle(fun: ExtensionInstance<FunctionConfigType>, options: JSFunctionBuildOptions, processEnv = process.env) {
    await checkForShopifyFunctionRuntimeEntrypoint(fun)

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

  async compile(
    fun: ExtensionInstance<FunctionConfigType>,
    options: JSFunctionBuildOptions,
    binaryDeps: BinaryDependencies,
  ) {
    const witContent = this.wit
    outputDebug('Generating world to use with Javy:')
    outputDebug(witContent)

    return inTemporaryDirectory(async (dir) => {
      const witPath = joinPath(dir, 'javy-world.wit')
      await writeFile(witPath, witContent)

      return runJavy(fun, options, binaryDeps, ['-C', `wit=${witPath}`, '-C', `wit-world=${JAVY_WORLD}`])
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
