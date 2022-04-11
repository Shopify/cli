import {git} from '@shopify/cli-kit'

export default async function downloadTemplate({templateUrl, into}: {templateUrl: string; into: string}) {
  const [repository, branch] = templateUrl.split('#')
  // eslint-disable-next-line @typescript-eslint/naming-convention
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
