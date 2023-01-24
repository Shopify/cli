import {FunctionExtension} from '../../models/app/extensions.js'
import {exec} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import {build as esBuild} from 'esbuild'
import {fileExists, findPathUp} from '@shopify/cli-kit/node/fs'

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
      'Could not find the Shopify Function runtime. Make sure you have @shopify/shopify_function installed',
    )
  }

  const jsUserFunction = joinPath(fun.directory, 'src/index.js')
  const tsUserFunction = joinPath(fun.directory, 'src/index.ts')

  let userFunction
  if (await fileExists(jsUserFunction)) {
    userFunction = jsUserFunction
  } else if (await fileExists(tsUserFunction)) {
    userFunction = tsUserFunction
  } else {
    throw new Error('Could not find your function entry point. It must be either src/index.js or src/index.ts')
  }

  const esbuildOptions = getESBuildOptions(fun.directory, entryPoint, userFunction)
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

export async function runFunctionRunner(fun: FunctionExtension, json: string) {
  return exec('npm', ['exec', '--', 'function-runner', json], {
    cwd: fun.directory,
    stdout: process.stdout,
    stderr: process.stderr,
  })
}
