import {git} from '@shopify/cli-kit'

export default async function downloadTemplate({templateUrl, into}: {templateUrl: string; into: string}) {
  const components = templateUrl.split('#')
  let branch: string | undefined
  const repository = components[0]
  if (components.length === 2) {
    branch = components[1]
  }
  const options: any = {'--recurse-submodules': null}
  if (branch) {
    options['--branch'] = branch
  }

  await git.factory().clone(repository, into, options, (err) => {
    if (err) {
      throw new Error(err.message)
    }
  })
}
