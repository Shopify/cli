import {renderTasks} from '@shopify/cli-kit/node/ui'
import {downloadGitRepository, getLatestTag} from '@shopify/cli-kit/node/git'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'

export const SKELETON_THEME_URL = 'https://github.com/Shopify/skeleton-theme.git'
export const DAWN_URL = 'https://github.com/Shopify/dawn.git'

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
        await downloadGitRepository({
          repoUrl,
          destination,
          latestTag,
        })
      },
    },
  ])
}

export async function getSkeletonThemeLatestTag() {
  return inTemporaryDirectory(async (tempDir) => {
    await downloadGitRepository({
      repoUrl: SKELETON_THEME_URL,
      destination: tempDir,
    })

    return getLatestTag(tempDir)
  })
}
