import {git, ui} from '@shopify/cli-kit'

export async function rawClone(repoUrl: string, destination: string) {
  await downloadRepository(repoUrl, destination)
}

export async function latestClone(repoUrl: string, destination: string) {
  await downloadRepository(repoUrl, destination, true)
}

async function downloadRepository(repoUrl: string, destination: string, latestRelease?: boolean) {
  await ui
    .newListr([
      {
        title: `Cloning ${repoUrl} into ${destination}`,
        task: async () => {
          await git.downloadRepository({
            repoUrl,
            destination,
            latestRelease,
          })
          return {
            successMessage: `Cloned into ${destination}`,
          }
        },
      },
    ])
    .run()
}
