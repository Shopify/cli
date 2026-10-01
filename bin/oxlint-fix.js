import {createHash} from 'node:crypto'
import {readdirSync, readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {createRequire} from 'node:module'
import {spawnSync} from 'node:child_process'

const require = createRequire(import.meta.url)
const oxlint = join(dirname(require.resolve('oxlint/package.json')), 'bin/oxlint')
const directories = process.argv.slice(2)
if (directories.length === 0) throw new Error('Provide at least one generated-code directory.')

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

// Import removal and ordering can produce overlapping fixes. Repeat only while
// files change, as ESLint's fixer did, and surface any remaining diagnostics.
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
