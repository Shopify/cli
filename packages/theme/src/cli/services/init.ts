import {git} from '@shopify/cli-kit'
import {renderTasks} from '@shopify/cli-kit/node/ui'

export async function cloneRepo(repoUrl: string, destination: string) {
  await downloadRepository(repoUrl, destination)
}

export async function cloneRepoAndCheckoutLatestTag(repoUrl: string, destination: string) {
  await downloadRepository(repoUrl, destination, true)
}

async function downloadRepository(repoUrl: string, destination: string, latestTag?: boolean) {
  await renderTasks([
    {
      title: `Cloning ${repoUrl} into ${destination}`,
      task: async () => {
        await git.downloadRepository({
          repoUrl,
          destination,
          latestTag,
        })
      },
    },
  ])
}
