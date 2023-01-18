import {exec} from '@shopify/cli-kit/node/system'
// import {build as esBuild} from 'esbuild'

export async function buildFunction(directory: string) {
  await buildGraphqlTypes(directory)
  await bundleExtension(directory)
  return runJavy(directory)
}

export async function buildGraphqlTypes(directory: string) {
  return exec('npm', ['exec', '--', 'graphql-code-generator', '-c', '.graphqlrc'], {
    cwd: directory,
    stdout: process.stdout,
    stderr: process.stderr,
  })
}

export async function bundleExtension(directory: string) {
  // const esbuildOptions = getESBuildOptions()
  // return esBuild(esbuildOptions)
  return exec('npm', ['exec', '--', 'vite', 'build'], {
    cwd: directory,
    stdout: process.stdout,
    stderr: process.stderr,
  })
}

// function getESBuildOptions(): Parameters<typeof esBuild>[0] {
//   const esbuildOptions: Parameters<typeof esBuild>[0] = {
//     outfile: 'dist',
//     bundle: true,
//     loader: {
//       '.esnext': 'ts',
//       '.js': 'jsx',
//     },
//     legalComments: 'none',
//     minify: true,
//     target: 'es6',
//     resolveExtensions: ['.tsx', '.ts', '.js', '.json', '.esnext', '.mjs', '.ejs'],
//   }
//   return esbuildOptions
// }

export async function runJavy(directory: string) {
  return exec('npm', ['exec', '--', 'javy', '-o', 'dist/function.wasm', 'dist/function.js'], {
    cwd: directory,
    stdout: process.stdout,
    stderr: process.stderr,
  })
}

export async function runFunctionRunner(directory: string, json: string) {
  return exec('npm', ['exec', '--', 'function-runner', json], {
    stdout: process.stdout,
    stderr: process.stderr,
  })
}
