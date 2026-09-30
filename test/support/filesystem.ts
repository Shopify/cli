import {cp, lstat, mkdir, readdir, readFile, readlink, realpath} from 'node:fs/promises'
// The fixture loader must not initialize CLI state in the test worker.
// eslint-disable-next-line no-restricted-imports
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path'

const harnessPaths = new Set([
  'bin',
  'home',
  'tmp',
  'config',
  'cache',
  'data',
  'state',
  'appdata',
  'localappdata',
  'oclif',
  'node_modules',
  'state.json',
  'trace.jsonl',
])

function isWithin(directory: string, candidate: string) {
  const path = relative(directory, candidate)
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`))
}

async function validateTree(directory: string, sourceRoot: string): Promise<void> {
  const entries = await readdir(directory, {withFileTypes: true})
  await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name)
      if (directory === sourceRoot && harnessPaths.has(entry.name)) {
        throw new Error(
          `Fixture path ${entry.name} conflicts with harness state; use seedState or runtime configuration instead`,
        )
      }
      if (entry.isSymbolicLink()) {
        const target = await readlink(path)
        if (isAbsolute(target) || !isWithin(sourceRoot, resolve(dirname(path), target))) {
          throw new Error(`Fixture symlink escapes its scenario: ${path} -> ${target}`)
        }
      } else if (entry.isDirectory()) {
        await validateTree(path, sourceRoot)
      } else if (!entry.isFile()) {
        throw new Error(`Unsupported fixture entry: ${path}`)
      }
    }),
  )
}

async function fingerprintTree(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, {withFileTypes: true})
  const values = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) return fingerprintTree(root, path)
      const stats = await lstat(path)
      const contents = entry.isSymbolicLink()
        ? `link:${await readlink(path)}`
        : (await readFile(path)).toString('base64')
      return [JSON.stringify([relative(root, path), stats.mode, stats.mtimeMs, contents])]
    }),
  )
  return values.flat().sort()
}

export async function reserveFilesystem(options: {fixturesRoot: string; destination: string; name: string}) {
  const fixturesRoot = await realpath(options.fixturesRoot)
  const requested = resolve(fixturesRoot, options.name)
  if (!options.name || isAbsolute(options.name) || requested === fixturesRoot || !isWithin(fixturesRoot, requested)) {
    throw new Error(`Invalid fixture name: ${options.name}`)
  }
  const source = await realpath(requested)
  if (!isWithin(fixturesRoot, source)) throw new Error(`Fixture directory escapes its catalog: ${options.name}`)
  if (!(await lstat(resolve(source, 'project'))).isDirectory())
    throw new Error(`Fixture ${options.name} needs a project directory`)
  await validateTree(source, source)
  const fingerprint = JSON.stringify(await fingerprintTree(source))
  // A real copy prevents one test's writes from changing another test's inputs.
  // Preserve relative symlinks verbatim; cp's default can point back into the source.
  await mkdir(options.destination, {recursive: true})
  const entries = await readdir(source)
  await Promise.all(
    entries.map((entry) =>
      cp(resolve(source, entry), resolve(options.destination, entry), {
        recursive: true,
        force: false,
        errorOnExist: true,
        verbatimSymlinks: true,
      }),
    ),
  )
  return async () => {
    if (JSON.stringify(await fingerprintTree(source)) !== fingerprint) {
      throw new Error(`Source fixture was modified during the test: ${options.name}`)
    }
  }
}
