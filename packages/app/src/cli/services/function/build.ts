import {FunctionExtension} from '../../models/app/extensions.js'
import {exec} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import {build as esBuild} from 'esbuild'
import {findPathUp} from '@shopify/cli-kit/node/fs'

export async function buildFunction(fun: FunctionExtension) {
  await buildGraphqlTypes(fun.directory)
  await bundleExtension(fun)
  return runJavy(fun)
}

export async function buildGraphqlTypes(directory: string) {
  return exec('npm', ['exec', '--', 'graphql-code-generator', '-c', '.graphqlrc'], {
    cwd: directory,
    stderr: process.stderr,
  })
}

export async function bundleExtension(fun: FunctionExtension) {
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
    logLevel: 'info',
    bundle: true,
    legalComments: 'none',
    target: 'es2022',
    format: 'esm',
  }
  return esbuildOptions
}

export async function runJavy(fun: FunctionExtension) {
  return exec('npm', ['exec', '--', 'javy', '-o', fun.buildWasmPath(), 'dist/function.js'], {
    cwd: fun.directory,
    stdout: process.stdout,
    stderr: process.stderr,
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
