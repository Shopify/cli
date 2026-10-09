import {ensureGitVersionIsAtLeast} from '@shopify/cli-kit/node/git'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'

export interface GitProtection {
  args?: string[]
  env?: Record<string, string>
}

/**
 * The scanned directory is untrusted, and Git reads settings from it that name programs to run. A repository
 * delivered with its `.git`, or a bare repository committed as ordinary files and so carried by a plain clone,
 * can set them. `runGit` applies every protection to every Git command in the engine.
 */
export const UNTRUSTED_REPOSITORY_PROTECTIONS = {
  // Reading the index runs the file-system monitor program. The empty value turns it off on every Git version;
  // older versions take `false` as the program's name.
  fileSystemMonitor: {args: ['-c', 'core.fsmonitor=']},
  // Refuses a bare repository Git would otherwise find in the working directory, such as one committed as files.
  bareRepository: {args: ['-c', 'safe.bareRepository=explicit']},
  // A partial clone fetches a missing object on demand, running the repository's transport commands.
  lazyFetch: {env: {GIT_NO_LAZY_FETCH: '1'}},
  // An empty allow-list refuses every transport, for Git versions that predate GIT_NO_LAZY_FETCH.
  transports: {env: {GIT_ALLOW_PROTOCOL: ''}},
} satisfies {[name: string]: GitProtection}

export type GitProtectionName = keyof typeof UNTRUSTED_REPOSITORY_PROTECTIONS

const minimumAppSecurityGitVersion = '2.38.0'

const protections: GitProtection[] = Object.values(UNTRUSTED_REPOSITORY_PROTECTIONS)
const protectionArguments = protections.flatMap((protection) => protection.args ?? [])

/** Extends the inherited environment. A fresh object each time, because the runner may add to it. */
function protectionEnvironment(): Record<string, string> {
  return Object.fromEntries(protections.flatMap((protection) => Object.entries(protection.env ?? {})))
}

interface GitResult {
  exitCode: number
  stdout: string
}

/**
 * Runs Git in the directory. Rejects when the Git selected there is missing, can't run, or is older than
 * `minimumAppSecurityGitVersion`. Undefined when the command itself throws instead of exiting.
 *
 * A version manager can select a different Git for each working directory, so the version is checked where the
 * command runs, before every command.
 */
export async function runGit(directory: string, args: string[]): Promise<GitResult | undefined> {
  await ensureGitVersionIsAtLeast(minimumAppSecurityGitVersion, {cwd: directory})
  try {
    const result = await captureOutputWithExitCode('git', [...protectionArguments, ...args], {
      cwd: directory,
      env: protectionEnvironment(),
    })
    return {exitCode: result.exitCode, stdout: result.stdout}
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
}
