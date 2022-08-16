import {parse} from './path.js'
import {Abort} from './error.js'
import {hasGit, isTerminalInteractive} from './environment/local.js'
import {content, token, debug} from './output.js'
import git, {TaskOptions, SimpleGitProgressEvent} from 'simple-git'

export const factory = git

export const GitNotPresentError = () => {
  return new Abort(
    `Git is necessary in the environment to continue`,
    content`Install ${token.link('git', 'https://git-scm.com/book/en/v2/Getting-Started-Installing-Git')}`,
  )
}

export const OutsideGitDirectoryError = () => {
  return new Abort('Must be inside a Git directory to continue')
}

export const MalformedRemoteUrlError = () => {
  return new Abort(
    'Git remote origin URL is malformed.',
    content`Run ${token.genericShellCommand('git remote -v')} to validate URL.`,
  )
}

export const NoCommitError = () => {
  return new Abort(
    'Must have at least one commit to run command',
    content`Run ${token.genericShellCommand("git commit -m 'Initial commit'")} to create your first commit.`,
  )
}

export const DetachedHeadError = () => {
  return new Abort(
    "Git HEAD can't be detached to run command",
    content`Run ${token.genericShellCommand('git checkout [branchName]')} to reattach HEAD`,
  )
}

export async function initializeRepository(directory: string) {
  debug(content`Initializing git repository at ${token.path(directory)}...`)
  await ensurePresentOrAbort()
  await git(directory).init()
}

export async function downloadRepository({
  repoUrl,
  destination,
  progressUpdater,
  shallow,
}: {
  repoUrl: string
  destination: string
  progressUpdater?: (statusString: string) => void
  shallow?: boolean
}) {
  debug(content`Git-cloning repository ${repoUrl} into ${token.path(destination)}...`)
  await ensurePresentOrAbort()
  const [repository, branch] = repoUrl.split('#')
  const options: TaskOptions = {'--recurse-submodules': null}
  if (branch) {
    options['--branch'] = branch
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
  } catch (err) {
    if (err instanceof Error) {
      const abortError = new Abort(err.message)
      abortError.stack = err.stack
      throw abortError
    }
    throw err
  }
}

export async function getRemoteRepository() {
  const remoteUrl = await git().getConfig('remote.origin.url', 'local')

  if (remoteUrl.value) {
    try {
      const urlObj = new URL(remoteUrl.value)
      const parsedPath = parse(urlObj.pathname)
      const repository = `${parsedPath.dir}/${parsedPath.name}`
      return repository.charAt(0) === '/' ? repository.substring(1) : repository
    } catch {
      throw MalformedRemoteUrlError()
    }
  }
}

export async function getLatestCommit() {
  try {
    const logs = await git().log({
      maxCount: 1,
    })
    if (!logs.latest) throw NoCommitError()
    return logs.latest
  } catch {
    throw NoCommitError()
  }
}

export async function getHeadSymbolicRef() {
  try {
    const ref = await git().raw('symbolic-ref', '-q', 'HEAD')
    if (!ref) throw DetachedHeadError()
    return ref.trim()
  } catch {
    throw DetachedHeadError()
  }
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
export async function ensureInsideGitDirectory(workingDirectory?: string) {
  const cwd = process.cwd()
  if (workingDirectory && cwd !== workingDirectory) process.chdir(workingDirectory)

  if (!(await git().checkIsRepo())) {
    throw OutsideGitDirectoryError()
  }
}
