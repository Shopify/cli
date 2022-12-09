import {Abort} from './error.js'
import {hasGit, isTerminalInteractive} from './environment/local.js'
import {content, token, debug} from './output.js'
import {appendSync} from './file.js'
import git, {TaskOptions, SimpleGitProgressEvent, DefaultLogFields, ListLogLine, SimpleGit} from 'simple-git'

export const factory = git

export const GitNotPresentError = () => {
  // eslint-disable-next-line rulesdir/no-error-factory-functions
  return new Abort(
    `Git is necessary in the environment to continue`,
    content`Install ${token.link('git', 'https://git-scm.com/book/en/v2/Getting-Started-Installing-Git')}`,
  )
}

export const OutsideGitDirectoryError = (directory: string) => {
  // eslint-disable-next-line rulesdir/no-error-factory-functions
  return new Abort(`${token.path(directory)} is not a Git directory`)
}

export const NoCommitError = () => {
  // eslint-disable-next-line rulesdir/no-error-factory-functions
  return new Abort(
    'Must have at least one commit to run command',
    content`Run ${token.genericShellCommand("git commit -m 'Initial commit'")} to create your first commit.`,
  )
}

export const DetachedHeadError = () => {
  // eslint-disable-next-line rulesdir/no-error-factory-functions
  return new Abort(
    "Git HEAD can't be detached to run command",
    content`Run ${token.genericShellCommand('git checkout [branchName]')} to reattach HEAD or see git ${token.link(
      'documentation',
      'https://git-scm.com/book/en/v2/Git-Internals-Git-References',
    )} for more details`,
  )
}

export async function initializeRepository(directory: string, initialBranch = 'main') {
  debug(content`Initializing git repository at ${token.path(directory)}...`)
  await ensurePresentOrAbort()
  // We use init and checkout instead of `init --initial-branch` because the latter is only supported in git 2.28+
  const repo = git(directory)
  await repo.init()
  await repo.checkoutLocalBranch(initialBranch)
}

export interface GitIgnoreTemplate {
  [section: string]: string[]
}
export function createGitIgnore(directory: string, template: GitIgnoreTemplate): void {
  debug(content`Creating .gitignore at ${token.path(directory)}...`)
  const filePath = `${directory}/.gitignore`

  let fileContent = ''
  for (const [section, lines] of Object.entries(template)) {
    fileContent += `# ${section}\n`
    fileContent += `${lines.join('\n')}\n\n`
  }

  appendSync(filePath, fileContent)
}

export async function downloadRepository({
  repoUrl,
  destination,
  progressUpdater,
  shallow,
  latestTag,
}: {
  repoUrl: string
  destination: string
  progressUpdater?: (statusString: string) => void
  shallow?: boolean
  latestTag?: boolean
}) {
  debug(content`Git-cloning repository ${repoUrl} into ${token.path(destination)}...`)
  await ensurePresentOrAbort()
  const [repository, branch] = repoUrl.split('#')
  const options: TaskOptions = {'--recurse-submodules': null}

  if (branch && latestTag) {
    throw new Abort("Error cloning the repository. Git can't clone the latest release with a 'branch'.")
  }
  if (branch) {
    options['--branch'] = branch
  }

  if (shallow && latestTag) {
    throw new Abort("Error cloning the repository. Git can't clone the latest release with the 'shallow' property.")
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
    await git(simpleGitOptions).clone(repository!, destination, options)

    if (latestTag) {
      const localGitRepository = git(destination)
      const latestTag = await getLocalLatestTag(localGitRepository, repoUrl)
      await localGitRepository.checkout(latestTag)
    }
  } catch (err) {
    if (err instanceof Error) {
      const abortError = new Abort(err.message)
      abortError.stack = err.stack
      throw abortError
    }
    throw err
  }
}

async function getLocalLatestTag(repository: SimpleGit, repoUrl: string) {
  const latest = (await repository.tags()).latest

  if (!latest) {
    throw new Abort(`Couldn't obtain the most recent tag of the repository ${repoUrl}`)
  }

  return latest
}

export async function getLatestCommit(directory?: string): Promise<DefaultLogFields & ListLogLine> {
  const logs = await git({baseDir: directory}).log({
    maxCount: 1,
  })
  if (!logs.latest) throw NoCommitError()
  return logs.latest
}

export async function addAll(directory?: string): Promise<void> {
  const simpleGit = git({baseDir: directory})
  await simpleGit.raw('add', '--all')
}

export async function commit(message: string, options?: {directory?: string; author?: string}): Promise<string> {
  const simpleGit = git({baseDir: options?.directory})

  const commitOptions = options?.author ? {'--author': options.author} : undefined
  const result = await simpleGit.commit(message, commitOptions)

  return result.commit
}

export async function getHeadSymbolicRef(directory?: string): Promise<string> {
  const ref = await git({baseDir: directory}).raw('symbolic-ref', '-q', 'HEAD')
  if (!ref) throw DetachedHeadError()
  return ref.trim()
}

/**
 * If "git" is not present in the environment it throws
 * an abort error.
 */
export async function ensurePresentOrAbort() {
  if (!(await hasGit())) {
    throw GitNotPresentError()
  }
}

/**
 * If command run from outside a .git directory tree
 * it throws an abort error.
 */
export async function ensureInsideGitDirectory(directory?: string) {
  if (!(await git({baseDir: directory}).checkIsRepo())) {
    throw OutsideGitDirectoryError(directory || process.cwd())
  }
}
