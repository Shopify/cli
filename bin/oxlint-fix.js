import {createHash} from 'node:crypto'
import {globSync, readdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {createRequire} from 'node:module'
import {spawnSync} from 'node:child_process'

const require = createRequire(import.meta.url)
const oxlint = join(dirname(require.resolve('oxlint/package.json')), 'bin/oxlint')
const directories = process.argv.slice(2)
if (directories.length === 0) throw new Error('Provide at least one generated-code directory.')

// Group schema and scalar imports separately from the document-node import.
for (const directory of directories) {
  for (const file of globSync('**/*.ts', {cwd: directory})) {
    const filename = join(directory, file)
    const source = readFileSync(filename, 'utf8')
    const formatted = source.replace(
      /^(import \* as Types from [^\n]+)\n\n(import \{JsonMapType\} from [^\n]+)\n/,
      '$1\n$2\n\n',
    )
    if (formatted !== source) writeFileSync(filename, formatted)
  }
}

function fingerprint(directory, hash) {
  for (const entry of readdirSync(directory, {withFileTypes: true}).sort((first, second) => first.name.localeCompare(second.name))) {
    const filename = join(directory, entry.name)
    if (entry.isDirectory()) fingerprint(filename, hash)
    else if (/\.tsx?$/.test(filename)) hash.update(filename).update(readFileSync(filename))
  }
}

function currentFingerprint() {
  const hash = createHash('sha256')
  for (const directory of directories) fingerprint(directory, hash)
  return hash.digest('hex')
}

// Import removal and ordering can produce overlapping fixes that need separate passes.
for (let attempt = 0; attempt < 10; attempt++) {
  const before = currentFingerprint()
  const result = spawnSync(process.execPath, [oxlint, '--config', '../../oxlint.json', '--fix', '--fix-suggestions', ...directories], {
    encoding: 'utf8',
  })
  if (result.status === 0 || currentFingerprint() === before || attempt === 9) {
    process.stdout.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    if (result.error) throw result.error
    process.exit(result.status ?? 1)
  }
}
