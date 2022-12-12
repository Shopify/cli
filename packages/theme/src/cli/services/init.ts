import {git, ui} from '@shopify/cli-kit'

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
          await git.downloadRepository({
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
