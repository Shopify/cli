/* eslint-disable @typescript-eslint/no-base-to-string */
import {hasGit, isTerminalInteractive} from './context/local.js'
import {appendFileSync} from './fs.js'
import {AbortError} from './error.js'
import {cwd} from './path.js'
import {runWithTimer} from './metadata.js'
import {outputContent, outputToken, outputDebug} from '../../public/node/output.js'
import git, {TaskOptions, SimpleGitProgressEvent, DefaultLogFields, ListLogLine, SimpleGit} from 'simple-git'

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
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const repo = git(directory)
  await repo.init()
  await repo.checkoutLocalBranch(initialBranch)
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
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const repo = git(directory)
  const ignoredLockfile = await repo.checkIgnore(files)
  return ignoredLockfile
}

export interface GitIgnoreTemplate {
  [section: string]: string[]
}
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
 * Options to use when cloning a git repository.
 *
 * @param repoUrl - The URL of the repository to clone.
 * @param destination - The directory where the repository will be cloned.
 * @param progressUpdater - A function that will be called with the progress of the clone.
 * @param shallow - Whether to clone the repository shallowly.
 * @param latestTag - Whether to clone the latest tag instead of the default branch.
 */
export interface GitCloneOptions {
  repoUrl: string
  destination: string
  progressUpdater?: (statusString: string) => void
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
    const {repoUrl, destination, progressUpdater, shallow, latestTag} = cloneOptions
    outputDebug(outputContent`Git-cloning repository ${repoUrl} into ${outputToken.path(destination)}...`)
    await ensureGitIsPresentOrAbort()
    const [repository, branch] = repoUrl.split('#')
    const options: TaskOptions = {'--recurse-submodules': null}

    if (branch && latestTag) {
      throw new AbortError("Error cloning the repository. Git can't clone the latest release with a 'branch'.")
    }
    if (branch) {
      options['--branch'] = branch
    }

    if (shallow && latestTag) {
      throw new AbortError(
        "Error cloning the repository. Git can't clone the latest release with the 'shallow' property.",
      )
    }
    if (shallow) {
      options['--depth'] = 1
    }

    const progress = ({stage, progress, processed, total}: SimpleGitProgressEvent) => {
      const updateString = `${stage}, ${processed}/${total} objects (${progress}% complete)`
      if (progressUpdater) progressUpdater(updateString)
    }

    const simpleGitOptions = {
      progress,
      ...(!isTerminalInteractive() && {config: ['core.askpass=true']}),
    }
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await git(simpleGitOptions).clone(repository!, destination, options)

      if (latestTag) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const localGitRepository = git(destination)
        const latestTag = await getLocalLatestTag(localGitRepository, repoUrl)
        await localGitRepository.checkout(latestTag)
      }
    } catch (err) {
      if (err instanceof Error) {
        const abortError = new AbortError(err.message)
        abortError.stack = err.stack
        throw abortError
      }
      throw err
    }
  })
}

/**
 * Get the most recent tag of a local git repository.
 *
 * @param repository - The local git repository.
 * @param repoUrl - The URL of the repository.
 * @returns The most recent tag of the repository.
 */
async function getLocalLatestTag(repository: SimpleGit, repoUrl: string): Promise<string> {
  const latest = (await repository.tags()).latest

  if (!latest) {
    throw new AbortError(`Couldn't obtain the most recent tag of the repository ${repoUrl}`)
  }

  return latest
}

/**
 * Get the latest commit of a git repository.
 *
 * @param directory - The directory of the git repository.
 * @returns The latest commit of the repository.
 */
export async function getLatestGitCommit(directory?: string): Promise<DefaultLogFields & ListLogLine> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const logs = await git({baseDir: directory}).log({
    maxCount: 1,
  })
  if (!logs.latest) {
    throw new AbortError(
      'Must have at least one commit to run command',
      outputContent`Run ${outputToken.genericShellCommand(
        "git commit -m 'Initial commit'",
      )} to create your first commit.`,
    )
  }
  return logs.latest
}

/**
 * Add all files to the git index from the given directory.
 *
 * @param directory - The directory where the git repository is located.
 * @returns A promise that resolves when the files are added to the index.
 */
export async function addAllToGitFromDirectory(directory?: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const simpleGit = git({baseDir: directory})
  await simpleGit.raw('add', '--all')
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
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const simpleGit = git({baseDir: options?.directory})

  const commitOptions = options?.author ? {'--author': options.author} : undefined
  const result = await simpleGit.commit(message, commitOptions)

  return result.commit
}

/**
 * Get the HEAD symbolic reference of a git repository.
 *
 * @param directory - The directory of the git repository.
 * @returns The HEAD symbolic reference of the repository.
 */
export async function getHeadSymbolicRef(directory?: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const ref = await git({baseDir: directory}).raw('symbolic-ref', '-q', 'HEAD')
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
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (!(await git({baseDir: directory}).checkIsRepo())) {
    throw new OutsideGitDirectoryError(`${outputToken.path(directory || cwd())} is not a Git directory`)
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
    throw new GitDirectoryNotCleanError(`${outputToken.path(directory || cwd())} is not a clean Git directory`)
  }
}

/**
 * Returns true if the .git directory tree is clean (no uncommitted changes).
 *
 * @param directory - The directory to check.
 * @returns True is the .git directory is clean.
 */
export async function isClean(directory?: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return (await git({baseDir: directory}).status()).isClean()
}
