import {Abort} from './error'
import {hasGit} from './environment/local'
import {content, token} from './output'
import git, {TaskOptions} from 'simple-git'

export const factory = git

export const GitNotPresentError = () => {
  return new Abort(
    `Git is necessary in the environment to continue`,
    content`Install ${token.link('git', 'https://git-scm.com/book/en/v2/Getting-Started-Installing-Git')}`,
  )
}

export async function initializeRepository(directory: string) {
  await git(directory).init()
}

export async function downloadRepository({repoUrl, destination}: {repoUrl: string; destination: string}) {
  const [repository, branch] = repoUrl.split('#')
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const options: TaskOptions = {'--recurse-submodules': null}
  if (branch) {
    options['--branch'] = branch
  }

  await git().clone(repository, destination, options, (err) => {
    if (err) {
      const abortError = new Abort(err.message)
      abortError.stack = err.stack
      throw abortError
    }
  })
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
