import {Abort} from './error'
import git, {TaskOptions} from 'simple-git'

export const factory = git

export async function initializeRepository(directory: string) {
  await git(directory).init()
}

export async function downloadRepository({
  repository,
  branch,
  destination,
}: {
  repository: string
  branch?: string
  destination: string
}) {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const options: TaskOptions = {'--recurse-submodules': null}
  if (branch) {
    options['--branch'] = branch
  }

  await git().clone(repository, destination, options, (err) => {
    if (err) {
      throw new Abort(err.message)
    }
  })
}
