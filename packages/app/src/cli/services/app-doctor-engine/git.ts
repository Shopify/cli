import {isAbsolutePath, joinPath, relativePath, resolvePath} from '@shopify/cli-kit/node/path'
// eslint-disable-next-line no-restricted-imports -- Git probes require an exact environment that cannot inherit repository-controlled process settings.
import {spawn} from 'node:child_process'
import {constants} from 'node:fs'
import {access, realpath, stat} from 'node:fs/promises'

interface GitCommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

const MAX_CAPTURED_OUTPUT_LENGTH = 1024 * 1024
const NULL_DEVICE = process.platform === 'win32' ? 'NUL' : '/dev/null'
const PATH_DELIMITER = process.platform === 'win32' ? ';' : ':'

function isWithin(root: string, path: string): boolean {
  const relative = relativePath(root, path)
  return relative === '' || (!relative.startsWith('../') && relative !== '..' && !isAbsolutePath(relative))
}

function sanitizedPathEntries(appRoot: string): string[] {
  return (process.env.PATH ?? '').split(PATH_DELIMITER).flatMap((entry) => {
    if (!entry || !isAbsolutePath(entry)) return []
    const absoluteEntry = resolvePath(entry)
    if (isWithin(appRoot, absoluteEntry) || absoluteEntry.replace(/\\/g, '/').includes('/node_modules/.bin')) return []
    return [absoluteEntry]
  })
}

async function executableCandidate(appRoot: string, path: string): Promise<string | undefined> {
  try {
    const executablePath = await realpath(path)
    if (isWithin(appRoot, executablePath)) return undefined
    const [metadata] = await Promise.all([stat(executablePath), access(executablePath, constants.X_OK)])
    return metadata.isFile() ? executablePath : undefined
    // Missing, inaccessible, and non-file PATH entries are safely ignored.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
}

async function resolveGitExecutable(appRoot: string): Promise<string | undefined> {
  const executableName = process.platform === 'win32' ? 'git.exe' : 'git'
  for (const directory of sanitizedPathEntries(appRoot)) {
    // Preserve PATH precedence while resolving to an absolute executable before changing cwd.
    // eslint-disable-next-line no-await-in-loop
    const executablePath = await executableCandidate(appRoot, joinPath(directory, executableName))
    if (executablePath) return executablePath
  }
  return undefined
}

function gitEnvironment(appRoot: string): Record<string, string | undefined> {
  const operatingSystemEnvironment = Object.fromEntries(
    ['PATHEXT', 'SystemRoot', 'COMSPEC', 'WINDIR'].flatMap((key) =>
      process.env[key] === undefined ? [] : [[key, process.env[key]]],
    ),
  )
  return {
    ...operatingSystemEnvironment,
    PATH: sanitizedPathEntries(appRoot).join(PATH_DELIMITER),
    NoDefaultCurrentDirectoryInExePath: '1',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: NULL_DEVICE,
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_PAGER: 'cat',
  }
}

/**
 * Run a read-only Git probe without honoring execution-capable repository or
 * user configuration. Repository metadata is untrusted scan input: notably,
 * `core.fsmonitor` can otherwise execute an arbitrary local command during
 * `git status`.
 */
export async function runHardenedGit(appRoot: string, args: string[]): Promise<GitCommandResult> {
  const executablePath = await resolveGitExecutable(appRoot)
  if (!executablePath) return {stdout: '', stderr: '', exitCode: 1}

  return new Promise((resolve) => {
    const child = spawn(
      executablePath,
      [
        '-c',
        'core.fsmonitor=false',
        '-c',
        `core.hooksPath=${NULL_DEVICE}`,
        '-c',
        'core.pager=cat',
        '--no-pager',
        ...args,
      ],
      {
        cwd: appRoot,
        env: gitEnvironment(appRoot),
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    )
    let stdout = ''
    let stderr = ''
    const appendWithinLimit = (current: string, chunk: string): string =>
      `${current}${chunk}`.slice(0, MAX_CAPTURED_OUTPUT_LENGTH)

    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout = appendWithinLimit(stdout, chunk)
    })
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr = appendWithinLimit(stderr, chunk)
    })
    child.once('error', () => resolve({stdout, stderr, exitCode: 1}))
    child.once('close', (exitCode) => resolve({stdout, stderr, exitCode: exitCode ?? 1}))
  })
}
