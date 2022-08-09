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
    await git(simpleGitOptions).clone(repository, destination, options)
  } catch (err) {
    if (err instanceof Error) {
      const abortError = new Abort(err.message)
      abortError.stack = err.stack
      throw abortError
    }
    throw err
  }
}

/**
 * If command run from outside a .git directory tree
 * it throws an abort error.
 */
export async function ensureInsideGitDirectory() {
  if (!(await git().checkIsRepo())) {
    throw OutsideGitDirectoryError()
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
