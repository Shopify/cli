import {build} from 'esbuild'
// Build the real CLI without importing its runtime into the Vitest process.
// eslint-disable-next-line no-restricted-imports
import {execFile} from 'node:child_process'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {tmpdir} from 'node:os'
// eslint-disable-next-line no-restricted-imports
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {promisify} from 'node:util'
import type {TestProject} from 'vitest/node'

const repository = fileURLToPath(new URL('../../', import.meta.url))

export default async function setup(project: TestProject) {
  // Build the real executable, including bundled command files which take precedence
  // over package dist files. Building only TypeScript could leave an old bundle in use.
  const bundleArguments = ['node_modules/.bin/nx', 'run', 'cli:bundle']
  if (process.env.SHOPIFY_CLI_SOURCE_COVERAGE === '1') bundleArguments.push('--skip-nx-cache')
  await promisify(execFile)('bash', bundleArguments, {
    cwd: repository,
    env: {...process.env, NX_DAEMON: 'false'},
    timeout: 180000,
    maxBuffer: 10 * 1024 * 1024,
  })

  const directory = await mkdtemp(resolve(tmpdir(), 'cli-command-build-'))
  try {
    const require = createRequire(resolve(repository, 'packages/cli-kit/package.json'))
    // Reuse CLI-kit's existing MSW dev dependency instead of adding another version.
    await build({
      entryPoints: [resolve(repository, 'test/support/preload.ts')],
      outfile: resolve(directory, 'preload.mjs'),
      bundle: true,
      platform: 'node',
      format: 'esm',
      plugins: [
        {
          name: 'external-msw',
          setup(builder) {
            builder.onResolve({filter: /^msw(?:\/node)?$/}, ({path}) => ({path: require.resolve(path), external: true}))
          },
        },
      ],
    })
    const subprocessStub = resolve(directory, 'subprocess.cjs')
    await writeFile(
      subprocessStub,
      'const response = JSON.parse(process.argv[2]); process.stdout.write(response.stdout || ""); process.stderr.write(response.stderr || ""); process.exitCode = response.exitCode || 0;\n',
    )
    project.provide('subprocessStub', subprocessStub)
    project.provide('commandPreload', resolve(directory, 'preload.mjs'))
    project.provide('cliEntrypoint', resolve(repository, 'packages/cli/bin/run.js'))
    return () => rm(directory, {recursive: true, force: true})
  } catch (error) {
    await rm(directory, {recursive: true, force: true})
    throw error
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    commandPreload: string
    cliEntrypoint: string
    subprocessStub: string
  }
}
