import {renderSelectPrompt, renderTasks} from '@shopify/cli-kit/node/ui'
import {downloadGitRepository, removeGitRemote} from '@shopify/cli-kit/node/git'
import {joinPath} from '@shopify/cli-kit/node/path'
import {rmdir, fileExists, inTemporaryDirectory, moveFile} from '@shopify/cli-kit/node/fs'

export const SKELETON_THEME_URL = 'https://github.com/Shopify/skeleton-theme'

const SUPPORTED_AI_INSTRUCTIONS = {
  github: 'VSCode (GitHub Copilot)',
  cursor: 'Cursor',
  claude: 'Claude',
}

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
          shallow: true,
        })
        await removeGitRemote(destination)

        if (repoUrl === SKELETON_THEME_URL) {
          await Promise.all(
            Object.keys(SUPPORTED_AI_INSTRUCTIONS).map(async (key) =>
              removeDirectory(joinPath(destination, `.${key}`)),
            ),
          )
          await removeDirectory(joinPath(destination, '.git'))
        }
      },
    },
  ])
}

async function removeDirectory(path: string) {
  if (await fileExists(path)) {
    await rmdir(path)
  }
}

export async function promptAndCreateAIInstructions(destination: string) {
  const aiChoice = await renderSelectPrompt({
    message: 'Set up AI dev support?',
    choices: [
      ...Object.entries(SUPPORTED_AI_INSTRUCTIONS).map(([key, value]) => ({
        label: value,
        value: key,
      })),
      {label: 'Skip', value: 'none'},
    ],
  })

  if (aiChoice === 'none') {
    return
  }

  await renderTasks([
    {
      title: `Adding AI instructions into ${destination}`,
      task: async () => {
        await inTemporaryDirectory(async (tempDir) => {
          await downloadGitRepository({
            repoUrl: `https://github.com/Shopify/theme-liquid-docs.git`,
            destination: tempDir,
            shallow: true,
          })
          const aiSrcDir = joinPath(tempDir, 'ai', aiChoice)
          const aiDestDir = joinPath(destination, `.${aiChoice}`)

          await moveFile(aiSrcDir, aiDestDir)
        })
      },
    },
  ])
}

// async function copyDirectoryContents(srcDir: string, destDir: string): Promise<void> {
//   if (!(await fileExists(srcDir))) {
//     return
//   }

//   if (!(await fileExists(destDir))) {
//     await mkdir(destDir)
//   }

//   // Get all files and directories in the source directory
//   const items = await glob(joinPath(srcDir, '**/*'))

//   console.log(items)
// }
