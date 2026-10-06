import {build as bundle, type Plugin} from 'esbuild'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import {inTemporaryDirectory, mkdir, writeFile, readFile, fileExists} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {expect, test} from 'vitest'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {existsSync, statSync} from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const repository = joinPath(here, '../../../../../..')
const workspace = joinPath(repository, 'packages')
const compilerFixture = `const fs = require('node:fs');
const args = process.argv.slice(2);
fs.writeFileSync('compiler-args.json', JSON.stringify(args));
if (!fs.readFileSync(args.at(-1), 'utf8').includes('harmless function')) process.exit(9);
process.stdout.write('COMPILER_STDOUT_MARKER\\n');
process.stderr.write('COMPILER_STDERR_MARKER\\n');
if (process.env.FIXTURE_COMPILER_FAIL === '1') process.exit(7);
fs.writeFileSync(args[args.indexOf('-o') + 1], Buffer.from([0,97,115,109,1,0,0,0]));
`

function sourceFile(path: string): string {
  for (const candidate of [path, `${path}.ts`, `${path}.tsx`, joinPath(path, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  throw new Error(`No fixture import source: ${path}`)
}

function plugins(pluginPath: string): Plugin[] {
  const binarySource = joinPath(here, 'binaries.ts')
  return [
    {
      name: 'external-compiler-resolution-only',
      setup(build) {
        build.onResolve({filter: /^real-fixture-binary-module$/}, () => ({path: binarySource}))
        build.onResolve({filter: /^\.\/binaries\.js$/}, (args) =>
          args.importer === joinPath(here, 'build.ts')
            ? {path: 'compiler-fixture-binaries', namespace: 'fixture-binary'}
            : undefined,
        )
        build.onLoad({filter: /.*/, namespace: 'fixture-binary'}, () => ({
          contents: `
export * from 'real-fixture-binary-module';
export const downloadBinary = async () => {};
export const javyBinary = () => ({path: process.execPath});
export const javyPluginBinary = () => ({path: ${JSON.stringify(pluginPath)}});
`,
          loader: 'js',
        }))
      },
    },
    {
      name: 'actual-workspace-source',
      setup(build) {
        // Resolve before tsconfig path aliases, retaining the actual built CLI Kit ESM package.
        build.onResolve({filter: /^@shopify\/cli-kit\//}, (args) => ({
          path: pathToFileURL(
            joinPath(workspace, 'cli-kit/dist/public', `${args.path.replace('@shopify/cli-kit/', '')}.js`),
          ).href,
          external: true,
        }))
        for (const name of ['organizations', 'theme', 'plugin-cloudflare']) {
          build.onResolve({filter: new RegExp(`^@shopify/${name}$`)}, () => ({
            path: sourceFile(joinPath(workspace, name, 'src/index')),
          }))
        }
      },
    },
  ]
}

async function fixture(root: string) {
  const directory = joinPath(root, 'function')
  await mkdir(joinPath(directory, 'src'))
  await mkdir(joinPath(directory, 'node_modules/@shopify/shopify_function'))
  await writeFile(joinPath(directory, 'package.json'), JSON.stringify({name: 'harmless-function-fixture'}))
  await writeFile(joinPath(directory, 'src/index.ts'), 'export const marker = "harmless function";')
  await writeFile(
    joinPath(directory, 'node_modules/@shopify/shopify_function/package.json'),
    JSON.stringify({version: '1.0.0'}),
  )
  await writeFile(
    joinPath(directory, 'node_modules/@shopify/shopify_function/index.ts'),
    'import {marker} from "user-function"; export {marker};',
  )
  await writeFile(joinPath(directory, 'node_modules/@shopify/shopify_function/run.ts'), '')
  await writeFile(joinPath(directory, 'build'), compilerFixture)
  await writeFile(
    joinPath(directory, 'typegen.cjs'),
    'require("node:fs").writeFileSync("generated-fixture.d.ts", "export type Fixture = {};\\n");',
  )
  const pluginPath = joinPath(directory, 'harmless-plugin.wasm')
  await writeFile(pluginPath, Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]))
  // Keep packages external beside the owned repository's node_modules. Bundle actual workspace code.
  const executable = joinPath(workspace, 'app/node_modules/.cache', `compiler-proof-${root.split(/[\\/]/).at(-1)}.mjs`)
  await mkdir(dirname(executable))
  await bundle({
    entryPoints: [joinPath(here, 'compiler-process.fixture.ts')],
    outfile: executable,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    packages: 'external',
    logLevel: 'silent',
    banner: {js: 'import {createRequire} from "node:module"; const require = createRequire(import.meta.url);'},
    plugins: plugins(pluginPath),
  })
  return {directory, executable, pluginPath, path: joinPath(directory, 'dist/index.wasm')}
}

function environment(root: string, json: boolean, failure: boolean): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    HOME: root,
    XDG_CONFIG_HOME: joinPath(root, 'config'),
    XDG_CACHE_HOME: joinPath(root, 'cache'),
    SHOPIFY_CLI_ENV: 'development',
    SHOPIFY_UNIT_TEST: '0',
    SHOPIFY_FLAG_JSON: json ? '1' : '0',
    SHOPIFY_FLAG_NO_INPUT: '1',
    FORCE_COLOR: '0',
    FIXTURE_COMPILER_FAIL: failure ? '1' : '0',
  }
}

test.each([
  {json: true, failure: false},
  {json: true, failure: true},
  {json: false, failure: false},
])(
  'outer OS streams reach actual Function dispatch/compiler: $json/$failure',
  {timeout: 30000},
  async ({json, failure}) => {
    await inTemporaryDirectory(async (root) => {
      const files = await fixture(root)
      const actual = await captureOutputWithExitCode(
        process.execPath,
        [files.executable, files.directory, json ? 'json' : 'text'],
        {cwd: files.directory, env: environment(root, json, failure)},
      )
      await writeFile(
        joinPath(repository, 'node_modules/.cache', `compiler-result-${json}-${failure}.json`),
        JSON.stringify(actual),
      )
      expect(actual.exitCode, actual.stderr + actual.stdout).toBe(failure ? 1 : 0)
      const args = JSON.parse(await readFile(joinPath(files.directory, 'compiler-args.json')))
      expect(args).toStrictEqual([
        '-C',
        'dynamic',
        '-C',
        `plugin=${files.pluginPath}`,
        '-o',
        files.path,
        'dist/function.js',
      ])
      if (json) {
        const document = JSON.parse(actual.stdout)
        if (failure) {
          expect(document).toHaveProperty('error')
          expect(document).not.toHaveProperty('status')
          await expect(fileExists(files.path)).resolves.toBe(false)
        } else {
          expect(document).toStrictEqual({status: 'success', path: files.path})
          expect([...Buffer.from(await readFile(files.path, {encoding: 'binary'}), 'binary')]).toStrictEqual([
            0, 97, 115, 109, 1, 0, 0, 0,
          ])
        }
        const events = actual.stderr
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
        expect(events.every((event) => event.type === 'diagnostic' || event.type === 'progress')).toBe(true)
        expect(events).toContainEqual(
          expect.objectContaining({type: 'diagnostic', message: expect.stringContaining('COMPILER_STDOUT_MARKER')}),
        )
        expect(events).toContainEqual(
          expect.objectContaining({type: 'diagnostic', message: expect.stringContaining('COMPILER_STDERR_MARKER')}),
        )
        expect(events.filter((event) => event.type === 'progress').at(-1)?.status).toBe(
          failure ? 'failed' : 'completed',
        )
      } else {
        expect(actual.stdout).toContain('COMPILER_STDOUT_MARKER')
        expect(actual.stderr).toContain('COMPILER_STDERR_MARKER')
      }
    })
  },
)
