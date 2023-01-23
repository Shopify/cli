import {FunctionExtension} from '../../models/app/extensions.js'
import {exec} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import {build as esBuild} from 'esbuild'

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
  const esbuildOptions = getESBuildOptions(fun.directory)
  return esBuild(esbuildOptions)
}

function getESBuildOptions(directory: string): Parameters<typeof esBuild>[0] {
  const esbuildOptions: Parameters<typeof esBuild>[0] = {
    outfile: joinPath(directory, 'dist/function.js'),
    entryPoints: [joinPath(directory, 'node_modules/@shopify/shopify_function/index.ts')],
    alias: {
      "user-function": joinPath(directory, 'src/index.js'),
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
