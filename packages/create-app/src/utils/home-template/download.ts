import {git} from '@shopify/cli-kit'

export default async function downloadTemplate({templateUrl, into}: {templateUrl: string; into: string}) {
  await git
    .factory()
    .clone(templateUrl, into, {'--recurse-submodules': null, '--branch': 'spike_separate_frontend'}, (err) => {
      if (err) {
        throw new Error(err.message)
      }
    })
}
