/* eslint-disable no-restricted-imports -- test helpers drive a real git binary against real temporary repositories */
import {vi} from 'vitest'
import {execFileSync} from 'node:child_process'
import {mkdtempSync, realpathSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'

/** Identity is pinned so commits work on CI runners without a global git identity. */
export function git(directory: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: directory,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  })
}

/**
 * Isolate git from the developer's global excludes, system config and any
 * enclosing repository. Repositories under test must live below `os.tmpdir()`.
 * The ceiling uses the real path because git compares it against its resolved
 * working directory (`/private/var/...` on macOS). Call the returned cleanup
 * in `afterEach`.
 */
export function isolateGitConfig(): () => void {
  const directory = mkdtempSync(join(tmpdir(), 'app-security-gitconfig-'))
  const globalConfig = join(directory, 'gitconfig')
  writeFileSync(globalConfig, '')
  vi.stubEnv('GIT_CONFIG_GLOBAL', globalConfig)
  vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1')
  vi.stubEnv('GIT_CEILING_DIRECTORIES', realpathSync.native(dirname(directory)))
  vi.stubEnv('XDG_CONFIG_HOME', directory)

  return () => {
    vi.unstubAllEnvs()
    rmSync(directory, {recursive: true, force: true})
  }
}
