import {FunctionExtension} from '../../models/app/extensions.js'
import {exec} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import {build as esBuild} from 'esbuild'
import {findPathUp} from '@shopify/cli-kit/node/fs'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {renderTasks} from '@shopify/cli-kit/node/ui'
import {Writable} from 'stream'

interface JSFunctionBuildOptions {
  stdout: Writable
  stderr: Writable
  signal?: AbortSignal
  useTasks?: boolean
}

export async function buildJSFunction(fun: FunctionExtension, options: JSFunctionBuildOptions) {
  if (options.useTasks) {
    return buildJSFunctionWithTasks(fun, options)
  } else {
    return buildJSFunctionWithoutTasks(fun, options)
  }
}

async function buildJSFunctionWithoutTasks(fun: FunctionExtension, options: JSFunctionBuildOptions) {
  options.stdout.write(`Building GraphQL types...\n`)
  await buildGraphqlTypes(fun.directory, options)
  options.stdout.write(`Bundling JS function...\n`)
  await bundleExtension(fun, options)
  options.stdout.write(`Running javy...\n`)
  await runJavy(fun, options)
  options.stdout.write(`Done!\n`)
}

export async function buildJSFunctionWithTasks(fun: FunctionExtension, options: JSFunctionBuildOptions) {
  return renderTasks([
    {
      title: 'Building GraphQL types',
      task: async () => {
        await buildGraphqlTypes(fun.directory, options)
      },
    },
    {
      title: 'Bundling JS function',
      task: async () => {
        await bundleExtension(fun, options)
      },
    },
    {
      title: 'Running javy',
      task: async () => {
        await runJavy(fun, options)
      },
    },
  ])
}

export async function buildGraphqlTypes(directory: string, options: JSFunctionBuildOptions) {
  return exec('npm', ['exec', '--', 'graphql-code-generator', '-c', '.graphqlrc'], {
    cwd: directory,
    stderr: options.stderr,
    signal: options.signal,
  })
}

export async function bundleExtension(fun: FunctionExtension, options: JSFunctionBuildOptions) {
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

  const esbuildOptions = getESBuildOptions(fun.directory, entryPoint, fun.entrySourceFilePath)
  return esBuild(esbuildOptions)
}

function getESBuildOptions(directory: string, entryPoint: string, userFunction: string): Parameters<typeof esBuild>[0] {
  const esbuildOptions: Parameters<typeof esBuild>[0] = {
    outfile: joinPath(directory, 'dist/function.js'),
    entryPoints: [entryPoint],
    alias: {
      'user-function': userFunction,
    },
    logLevel: 'silent',
    bundle: true,
    legalComments: 'none',
    target: 'es2022',
    format: 'esm',
  }
  return esbuildOptions
}

export async function runJavy(fun: FunctionExtension, options: JSFunctionBuildOptions) {
  return exec('npm', ['exec', '--', 'javy', '-o', fun.buildWasmPath(), 'dist/function.js'], {
    cwd: fun.directory,
    stdout: options.stdout,
    stderr: options.stderr,
    signal: options.signal,
  })
}

export async function runFunctionRunner(fun: FunctionExtension) {
  return exec('npm', ['exec', '--', 'function-runner', '-f', fun.buildWasmPath()], {
    cwd: fun.directory,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })
}
