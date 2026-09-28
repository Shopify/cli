/* eslint-disable no-restricted-imports -- test helpers drive a real git binary against real temporary repositories */
import {vi} from 'vitest'
import {execFileSync} from 'node:child_process'
import {mkdtempSync, realpathSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'

/**
 * Run a git command in `directory` and return its stdout.
 *
 * Author and committer identity are pinned so commits work on machines (and CI
 * runners) that have no global git identity configured. stderr is piped so a
 * failing fixture command surfaces git's own message in the thrown error.
 */
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
 * Make every git invocation in the current test independent of the developer
 * machine: both the test's own `git()` calls and the production code's git
 * calls (which inherit `process.env`).
 *
 * A developer's global `core.excludesFile`, `$XDG_CONFIG_HOME/git/ignore`
 * (read whenever `core.excludesFile` is unset, which is exactly the state this
 * helper creates) or system config would otherwise silently change which paths
 * git reports as ignored, and a temporary directory could be discovered as
 * part of an enclosing repository (for example a home-directory dotfiles repo).
 *
 * A dedicated temporary directory is created under `os.tmpdir()` holding an
 * empty `gitconfig` (an empty file rather than `/dev/null` so the helper also
 * works on Windows). The same directory becomes `XDG_CONFIG_HOME`; it contains
 * no `git/ignore`, and `GIT_CONFIG_GLOBAL` already overrides its `git/config`.
 * `os.tmpdir()` becomes `GIT_CEILING_DIRECTORIES`, so repositories under test
 * must live somewhere below `os.tmpdir()` (as `mkdtemp` places them) to remain
 * discoverable; git stops climbing once it reaches the ceiling itself. The
 * ceiling is compared against git's RESOLVED working directory, so it is set
 * from the real path: on macOS `os.tmpdir()` is `/var/...` but git sees
 * `/private/var/...`, and on Windows the temp path may use an 8.3 short name.
 *
 * Returns a cleanup function that restores the environment (all stubs, via
 * `vi.unstubAllEnvs()`) and removes the directory. Call it in `afterEach`; the
 * vitest config does not enable `unstubEnvs`.
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
