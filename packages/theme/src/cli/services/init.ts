import {ui} from '@shopify/cli-kit'
import {downloadGitRepository} from '@shopify/cli-kit/node/git'

export async function cloneRepo(repoUrl: string, destination: string) {
  await downloadRepository(repoUrl, destination)
}

export async function cloneRepoAndCheckoutLatestTag(repoUrl: string, destination: string) {
  await downloadRepository(repoUrl, destination, true)
}

async function downloadRepository(repoUrl: string, destination: string, latestTag?: boolean) {
  await ui
    .newListr([
      {
        title: `Cloning ${repoUrl} into ${destination}`,
        task: async () => {
          await downloadGitRepository({
            repoUrl,
            destination,
            latestTag,
          })
          return {
            successMessage: `Cloned into ${destination}`,
          }
        },
      },
    ])
    .run()
}
