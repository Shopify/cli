/* eslint-disable no-restricted-imports -- the scanned repositories are real temporary git repositories */
import {git, isolateGitConfig} from './git-test-helpers.js'
import {scanDirectory as scan} from './scan-directory.js'
import {UNTRUSTED_REPOSITORY_PROTECTIONS} from '../scanners/git.js'
import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {spawnSync} from 'node:child_process'
import {chmodSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import type {GitProtection, GitProtectionName} from '../scanners/git.js'

/**
 * A scanned repository can name programs for Git to run. Every fixture is first shown to run its program under
 * plain Git, so a fixture that has quietly stopped being dangerous fails instead of passing.
 */

const temporaryDirectories: string[] = []
let restoreGitConfig: (() => void) | undefined

beforeEach(() => {
  restoreGitConfig = isolateGitConfig()
})

afterEach(() => {
  restoreGitConfig?.()
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, {recursive: true, force: true})
})

function makeDirectory(): string {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'app-security-untrusted-')))
  temporaryDirectories.push(directory)
  return directory
}

function writeFiles(root: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(root, path)
    mkdirSync(join(fullPath, '..'), {recursive: true})
    writeFileSync(fullPath, content)
  }
}

// Assembled at runtime so secret scanners pointed at this repository don't flag a literal.
const environmentSecret = () => `SHOPIFY_API_SECRET=${['shp', 'ss_', '0123456789abcdef'.repeat(2)].join('')}\n`

const appFiles = () => ({
  'shopify.app.toml': 'name = "untrusted"\nclient_id = "abc123"\napplication_url = "https://example.com"\n',
  '.env': environmentSecret(),
})

/** A shell command Git would run for the repository; it only records that it ran. Git for Windows runs it in sh. */
function recordingCommand(marker: string, label: string): string {
  return `echo ${label} >> '${marker.replace(/\\/g, '/')}'; false`
}

/** A repository, the program it plants, and a Git command that runs that program. */
interface Fixture {
  directory: string
  marker: string
  probe: string[]
}

/** A repository delivered with its `.git`, whose own configuration names a file-system monitor. */
function deliveredWithGitDirectory(): Fixture {
  const directory = makeDirectory()
  const marker = join(makeDirectory(), 'ran')
  git(directory, ['init', '-q', '.'])
  writeFiles(directory, appFiles())
  git(directory, ['add', 'shopify.app.toml'])
  git(directory, ['commit', '-qm', 'init'])
  git(directory, ['config', 'core.fsmonitor', recordingCommand(marker, 'fsmonitor')])
  return {directory, marker, probe: ['ls-files', '--cached']}
}

/** A bare repository committed as ordinary files, which a plain clone checks out. */
function committedBareRepository(): Fixture {
  const parent = makeDirectory()
  const marker = join(makeDirectory(), 'ran')
  const published = join(parent, 'published')
  mkdirSync(published)
  git(published, ['init', '-q', '.'])
  writeFiles(published, {
    'README.md': 'A starter.\n',
    ...Object.fromEntries(Object.entries(appFiles()).map(([path, content]) => [`app/${path}`, content])),
    // None of these is named .git, so Git tracks them.
    'app/HEAD': 'ref: refs/heads/main\n',
    'app/config': `[core]\n\trepositoryformatversion = 0\n\tbare = false\n\tworktree = .\n\tfsmonitor = "${recordingCommand(marker, 'fsmonitor')}"\n`,
    'app/objects/info/packs': '',
    'app/refs/heads/.keep': '',
  })
  git(published, ['add', '-A'])
  git(published, ['commit', '-qm', 'init'])
  git(parent, ['clone', '-q', published, 'clone'])
  return {directory: join(parent, 'clone', 'app'), marker, probe: ['ls-files', '--cached']}
}

/** A partial clone missing a skip-worktree .gitignore, which Git would fetch through the named transport command. */
function partialCloneMissingObject(): Fixture {
  const directory = makeDirectory()
  const marker = join(makeDirectory(), 'ran')
  git(directory, ['init', '-q', '.'])
  writeFiles(directory, {...appFiles(), 'web/.gitignore': 'build/\n', 'web/.env': environmentSecret()})
  git(directory, ['add', 'shopify.app.toml', 'web/.gitignore'])
  git(directory, ['commit', '-qm', 'init'])
  const blob = git(directory, ['rev-parse', ':web/.gitignore']).trim()
  git(directory, ['update-index', '--skip-worktree', 'web/.gitignore'])
  rmSync(join(directory, 'web', '.gitignore'))
  const object = join(directory, '.git', 'objects', blob.slice(0, 2), blob.slice(2))
  // Git writes objects read-only, which Windows won't delete.
  chmodSync(object, 0o644)
  rmSync(object)
  git(directory, ['config', 'core.repositoryformatversion', '1'])
  git(directory, ['config', 'extensions.partialClone', 'origin'])
  git(directory, ['config', 'remote.origin.url', 'ssh://example.invalid/app'])
  git(directory, ['config', 'remote.origin.promisor', 'true'])
  git(directory, ['config', 'core.sshCommand', recordingCommand(marker, 'ssh')])
  return {directory, marker, probe: ['ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--directory']}
}

/** Runs Git without the engine; a protection may make it refuse, so the exit status isn't checked. */
function plainGit(fixture: Fixture, protection: GitProtection = {}): void {
  spawnSync('git', [...(protection.args ?? []), ...fixture.probe], {
    cwd: fixture.directory,
    env: {...process.env, ...protection.env},
    stdio: 'ignore',
  })
}

function expectPlainGitRunsProgram(fixture: Fixture): void {
  plainGit(fixture)
  expect(existsSync(fixture.marker)).toBe(true)
  rmSync(fixture.marker)
}

function committedSecret(result: Awaited<ReturnType<typeof scan>>) {
  return result.issues.find((issue) => issue.id === 'COMMITTED_SECRET')
}

// Typed by protection name, so a protection added without a fixture fails type-checking.
const fixtureFor: Record<GitProtectionName, () => Fixture> = {
  fileSystemMonitor: deliveredWithGitDirectory,
  bareRepository: committedBareRepository,
  lazyFetch: partialCloneMissingObject,
  transports: partialCloneMissingObject,
}

describe('each untrusted repository protection, on its own', () => {
  test.each(Object.keys(fixtureFor) as GitProtectionName[])('%s stops the program its fixture plants', (name) => {
    const fixture = fixtureFor[name]()
    expectPlainGitRunsProgram(fixture)

    plainGit(fixture, UNTRUSTED_REPOSITORY_PROTECTIONS[name])

    expect(existsSync(fixture.marker)).toBe(false)
  })
})

describe('scanning an untrusted repository', () => {
  test('does not run the file-system monitor named by a repository delivered with its .git', async () => {
    const fixture = deliveredWithGitDirectory()
    expectPlainGitRunsProgram(fixture)

    const result = await scan(fixture.directory)

    expect(existsSync(fixture.marker)).toBe(false)
    // Git still answers: the secret is confirmed untracked and not ignored.
    expect(committedSecret(result)?.detection_evidence).toEqual([
      'git ls-files --error-unmatch .env → untracked',
      'git check-ignore -q .env → not ignored',
    ])
  })

  test('refuses a bare repository committed as ordinary files and carried by a clone', async () => {
    const fixture = committedBareRepository()
    expectPlainGitRunsProgram(fixture)

    const result = await scan(fixture.directory)

    expect(existsSync(fixture.marker)).toBe(false)
    // Git refuses the committed repository rather than answering from it, so the secret stays reported.
    expect(committedSecret(result)?.detection_evidence).toEqual([
      'git rev-parse --is-inside-work-tree → not a work tree',
    ])
  })

  test('does not fetch a missing object through the transport command a partial clone names', async () => {
    const fixture = partialCloneMissingObject()
    expectPlainGitRunsProgram(fixture)

    await scan(fixture.directory)

    expect(existsSync(fixture.marker)).toBe(false)
  })
})
