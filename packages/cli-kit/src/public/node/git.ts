import {outputContent, outputToken, outputDebug} from './output.js'
import {hasGit, isTerminalInteractive} from './context/local.js'
import {
  appendFileSync,
  detectEOL,
  fileExists,
  fileExistsSync,
  glob,
  isDirectory,
  readFileSync,
  writeFileSync,
} from './fs.js'
import {AbortError} from './error.js'
import {cwd, joinPath} from './path.js'
import {runWithTimer} from './metadata.js'
import {execa} from 'execa'

import ignore from 'ignore'

export interface GitLogEntry {
  hash: string
  date: string
  message: string
  refs: string
  body: string
  author_name: string
  author_email: string
}

async function gitCommand(args: string[], directory?: string): Promise<string> {
  try {
    const result = await execa('git', args, {cwd: directory})
    return result.stdout
  } catch (err) {
    if (err instanceof Error) {
      const abortError = new AbortError(err.message)
      abortError.stack = err.stack
      if ('exitCode' in err) {
        Object.assign(abortError, {exitCode: err.exitCode})
      }
      throw abortError
    }
    throw err
  }
}

/**
 * Initialize a git repository at the given directory.
 *
 * @param directory - The directory where the git repository will be initialized.
 * @param initialBranch - The name of the initial branch.
 */
export async function initializeGitRepository(directory: string, initialBranch = 'main'): Promise<void> {
  outputDebug(outputContent`Initializing git repository at ${outputToken.path(directory)}...`)
  await ensureGitIsPresentOrAbort()
  // We use init and checkout instead of `init --initial-branch` because the latter is only supported in git 2.28+
  await gitCommand(['init'], directory)
  await gitCommand(['checkout', '-b', initialBranch], directory)
}

/**
 * Given a Git repository and a list of absolute paths to files contained
 * in the repository, it filters and returns the files that are ignored
 * by the .gitignore.
 *
 * @param directory - The absolute path to the directory containing the files.
 * @param files - The list of files to check against.
 * @returns Files ignored by the lockfile.
 */
export async function checkIfIgnoredInGitRepository(directory: string, files: string[]): Promise<string[]> {
  try {
    const stdout = await gitCommand(['check-ignore', ...files], directory)
    return stdout.split('\n').filter(Boolean)
  } catch (error) {
    // git check-ignore exits with code 1 when no files are ignored
    if (error instanceof AbortError && 'exitCode' in error && error.exitCode === 1) return []
    throw error
  }
}

export type GitIgnoreTemplate = Record<string, string[]>
/**
 * Create a .gitignore file in the given directory.
 *
 * @param directory - The directory where the .gitignore file will be created.
 * @param template - The template to use to create the .gitignore file.
 */
export function createGitIgnore(directory: string, template: GitIgnoreTemplate): void {
  outputDebug(outputContent`Creating .gitignore at ${outputToken.path(directory)}...`)
  const filePath = `${directory}/.gitignore`

  let fileContent = ''
  for (const [section, lines] of Object.entries(template)) {
    fileContent += `# ${section}\n`
    fileContent += `${lines.join('\n')}\n\n`
  }

  appendFileSync(filePath, fileContent)
}

/**
 * Add an entry to an existing .gitignore file.
 *
 * If the .gitignore file doesn't exist, or if the entry is already present,
 * no changes will be made.
 *
 * @param root - The directory containing the .gitignore file.
 * @param entry - The entry to add to the .gitignore file.
 */
export function addToGitIgnore(root: string, entry: string): void {
  const gitIgnorePath = joinPath(root, '.gitignore')

  if (!fileExistsSync(gitIgnorePath)) {
    // When the .gitignore file does not exist, the CLI should not be opinionated about creating it
    return
  }

  const gitIgnoreContent = readFileSync(gitIgnorePath).toString()
  const eol = detectEOL(gitIgnoreContent)

  const lines = gitIgnoreContent.split(eol).map((line) => line.trim())
  const ignoreManager = ignore.default({allowRelativePaths: true}).add(lines)

  const isIgnoredEntry = ignoreManager.ignores(joinPath(entry))
  const isIgnoredEntryAsDir = ignoreManager.ignores(joinPath(entry, 'ignored.txt'))
  const isAlreadyIgnored = isIgnoredEntry || isIgnoredEntryAsDir
  if (isAlreadyIgnored) {
    // The file is already ignored by an existing pattern
    return
  }

  if (gitIgnoreContent.endsWith(eol)) {
    writeFileSync(gitIgnorePath, `${gitIgnoreContent}${entry}${eol}`)
  } else {
    writeFileSync(gitIgnorePath, `${gitIgnoreContent}${eol}${entry}${eol}`)
  }
}

/**
 * Options to use when cloning a git repository.
 *
 * @param repoUrl - The URL of the repository to clone.
 * @param destination - The directory where the repository will be cloned.
 * @param shallow - Whether to clone the repository shallowly.
 * @param latestTag - Whether to clone the latest tag instead of the default branch.
 */
export interface GitCloneOptions {
  repoUrl: string
  destination: string
  shallow?: boolean
  latestTag?: boolean
}
/**
 * Clone a git repository.
 *
 * @param cloneOptions - The options to use to clone the repository.
 * @returns A promise that resolves when the clone is complete.
 */
export async function downloadGitRepository(cloneOptions: GitCloneOptions): Promise<void> {
  return runWithTimer('cmd_all_timing_network_ms')(async () => {
    const {repoUrl, destination, shallow, latestTag} = cloneOptions
    outputDebug(outputContent`Git-cloning repository ${repoUrl} into ${outputToken.path(destination)}...`)
    await ensureGitIsPresentOrAbort()

    // Validate destination directory before attempting to clone
    if (await fileExists(destination)) {
      // Check if it's a directory
      if (!(await isDirectory(destination))) {
        throw new AbortError(
          outputContent`Can't clone to ${outputToken.path(destination)}`,
          "The path exists but isn't a directory.",
        )
      }

      // Check if directory is empty
      const entries = await glob(['*', '.*'], {
        cwd: destination,
        deep: 1,
        onlyFiles: false,
      })

      if (entries.length > 0) {
        throw new AbortError(
          outputContent`Directory ${outputToken.path(destination)} already exists and is not empty`,
          outputContent`Choose a different name or remove the existing directory first.`,
        )
      }
    }

    const [repository, branch] = repoUrl.split('#')

    if (branch && latestTag) {
      throw new AbortError("Error cloning the repository. Git can't clone the latest release with a 'branch'.")
    }

    if (shallow && latestTag) {
      throw new AbortError(
        "Error cloning the repository. Git can't clone the latest release with the 'shallow' property.",
      )
    }

    const args = ['clone', '--recurse-submodules']
    if (branch) {
      args.push('--branch', branch)
    }
    if (shallow) {
      args.push('--depth', '1')
    }
    if (!isTerminalInteractive()) {
      args.push('-c', 'core.askpass=true')
    }
    args.push(repository!, destination)

    try {
      await execa('git', args)

      if (latestTag) {
        const tag = await getLatestTagFromDirectory(destination, repoUrl)
        await gitCommand(['checkout', tag], destination)
      }
    } catch (err) {
      if (err instanceof AbortError) {
        throw err
      }
      if (err instanceof Error) {
        const abortError = new AbortError(err.message)
        abortError.stack = err.stack
        throw abortError
      }
      throw err
    }
  })
}

async function getLatestTagFromDirectory(directory: string, repoUrl: string): Promise<string> {
  const stdout = await gitCommand(['describe', '--tags', '--abbrev=0'], directory)
  const tag = stdout.trim()

  if (!tag) {
    throw new AbortError(`Couldn't obtain the most recent tag of the repository ${repoUrl}`)
  }

  return tag
}

/**
 * Get the latest commit of a git repository.
 *
 * @param directory - The directory of the git repository.
 * @returns The latest commit of the repository.
 */
export async function getLatestGitCommit(directory?: string): Promise<GitLogEntry> {
  const format = '%H%x00%ai%x00%s%x00%D%x00%b%x00%an%x00%ae'
  const stdout = await gitCommand(['log', '-1', `--format=${format}`], directory)
  if (!stdout.trim()) {
    throw new AbortError(
      'Must have at least one commit to run command',
      outputContent`Run ${outputToken.genericShellCommand(
        "git commit -m 'Initial commit'",
      )} to create your first commit.`,
    )
  }
  const parts = stdout.split('\x00')
  return {
    hash: parts[0]!,
    date: parts[1]!,
    message: parts[2]!,
    refs: parts[3]!,
    body: parts[4]!,
    author_name: parts[5]!,
    author_email: parts[6]!,
  }
}

/**
 * Add all files to the git index from the given directory.
 *
 * @param directory - The directory where the git repository is located.
 * @returns A promise that resolves when the files are added to the index.
 */
export async function addAllToGitFromDirectory(directory?: string): Promise<void> {
  await gitCommand(['add', '--all'], directory)
}

export interface CreateGitCommitOptions {
  directory?: string
  author?: string
}

/**
 * Create a git commit.
 *
 * @param message - The message of the commit.
 * @param options - The options to use to create the commit.
 * @returns The hash of the created commit.
 */
export async function createGitCommit(message: string, options?: CreateGitCommitOptions): Promise<string> {
  const args = ['commit', '-m', message]
  if (options?.author) {
    args.push('--author', options.author)
  }
  await gitCommand(args, options?.directory)
  const stdout = await gitCommand(['rev-parse', 'HEAD'], options?.directory)
  return stdout.trim()
}

/**
 * Get the HEAD symbolic reference of a git repository.
 *
 * @param directory - The directory of the git repository.
 * @returns The HEAD symbolic reference of the repository.
 */
export async function getHeadSymbolicRef(directory?: string): Promise<string> {
  const ref = await gitCommand(['symbolic-ref', '-q', 'HEAD'], directory)
  if (!ref) {
    throw new AbortError(
      "Git HEAD can't be detached to run command",
      outputContent`Run ${outputToken.genericShellCommand(
        'git checkout [branchName]',
      )} to reattach HEAD or see git ${outputToken.link(
        'documentation',
        'https://git-scm.com/book/en/v2/Git-Internals-Git-References',
      )} for more details`,
    )
  }
  return ref.trim()
}

/**
 * If "git" is not present in the environment it throws
 * an abort error.
 */
export async function ensureGitIsPresentOrAbort(): Promise<void> {
  if (!(await hasGit())) {
    throw new AbortError(
      `Git is necessary in the environment to continue`,
      outputContent`Install ${outputToken.link(
        'git',
        'https://git-scm.com/book/en/v2/Getting-Started-Installing-Git',
      )}`,
    )
  }
}

export class OutsideGitDirectoryError extends AbortError {}
/**
 * If command run from outside a .git directory tree
 * it throws an abort error.
 *
 * @param directory - The directory to check.
 */
export async function ensureInsideGitDirectory(directory?: string): Promise<void> {
  if (!(await insideGitDirectory(directory))) {
    throw new OutsideGitDirectoryError(`${outputToken.path(directory ?? cwd())} is not a Git directory`)
  }
}

/**
 * Returns true if the given directory is inside a .git directory tree.
 *
 * @param directory - The directory to check.
 * @returns True if the directory is inside a .git directory tree.
 */
export async function insideGitDirectory(directory?: string): Promise<boolean> {
  try {
    await execa('git', ['rev-parse', '--git-dir'], {cwd: directory})
    return true
  } catch (error) {
    if (error instanceof Error && 'exitCode' in error && error.exitCode === 128) return false
    throw error
  }
}

export class GitDirectoryNotCleanError extends AbortError {}
/**
 * If the .git directory tree is not clean (has uncommitted changes)
 * it throws an abort error.
 *
 * @param directory - The directory to check.
 */
export async function ensureIsClean(directory?: string): Promise<void> {
  if (!(await isClean(directory))) {
    throw new GitDirectoryNotCleanError(`${outputToken.path(directory ?? cwd())} is not a clean Git directory`)
  }
}

/**
 * Returns true if the .git directory tree is clean (no uncommitted changes).
 *
 * @param directory - The directory to check.
 * @returns True is the .git directory is clean.
 */
export async function isClean(directory?: string): Promise<boolean> {
  const stdout = await gitCommand(['status', '--porcelain'], directory)
  return stdout.trim() === ''
}

/**
 * Returns the latest tag of a git repository.
 *
 * @param directory - The directory to check.
 * @returns String with the latest tag or undefined if no tags are found.
 */
export async function getLatestTag(directory?: string): Promise<string | undefined> {
  try {
    const stdout = await gitCommand(['describe', '--tags', '--abbrev=0'], directory)
    return stdout.trim() || undefined
  } catch (error) {
    if (error instanceof AbortError && 'exitCode' in error && error.exitCode === 128) return undefined
    throw error
  }
}

/**
 * Remove a git remote from the given directory.
 *
 * @param directory - The directory where the git repository is located.
 * @param remoteName - The name of the remote to remove (defaults to 'origin').
 * @returns A promise that resolves when the remote is removed.
 */
export async function removeGitRemote(directory: string, remoteName = 'origin'): Promise<void> {
  outputDebug(outputContent`Removing git remote ${remoteName} from ${outputToken.path(directory)}...`)
  await ensureGitIsPresentOrAbort()

  const stdout = await gitCommand(['remote'], directory)
  const remotes = stdout.split('\n').filter(Boolean)

  if (!remotes.includes(remoteName)) {
    outputDebug(outputContent`Remote ${remoteName} does not exist, no action needed`)
    return
  }

  await gitCommand(['remote', 'remove', remoteName], directory)
}
