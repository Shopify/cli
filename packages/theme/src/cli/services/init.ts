import {renderSelectPrompt, renderTasks} from '@shopify/cli-kit/node/ui'
import {downloadGitRepository, removeGitRemote} from '@shopify/cli-kit/node/git'
import {joinPath} from '@shopify/cli-kit/node/path'
import {rmdir, fileExists, inTemporaryDirectory, copyDirectoryContents} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'

export const SKELETON_THEME_URL = 'https://github.com/Shopify/skeleton-theme.git'
const AI_INSTRUCTIONS_REPO_URL = 'https://github.com/Shopify/theme-liquid-docs.git'

const SUPPORTED_AI_INSTRUCTIONS = {
  github: 'VS Code (GitHub Copilot)',
  cursor: 'Cursor',
  claude: 'Claude',
}

type AIInstruction = keyof typeof SUPPORTED_AI_INSTRUCTIONS

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

export async function promptAIInstruction() {
  const aiChoice = (await renderSelectPrompt({
    message: 'Include LLM instructions in the theme?',
    choices: [
      ...Object.entries(SUPPORTED_AI_INSTRUCTIONS).map(([key, value]) => ({
        label: value,
        value: key,
      })),
      {label: 'Skip', value: null},
    ],
  })) as AIInstruction | null

  return aiChoice
}

export async function createAIInstructions(themeRoot: string, aiInstruction: AIInstruction) {
  await renderTasks([
    {
      title: `Adding AI instructions into ${themeRoot}`,
      task: async () => {
        await inTemporaryDirectory(async (tempDir) => {
          await downloadGitRepository({
            repoUrl: AI_INSTRUCTIONS_REPO_URL,
            destination: tempDir,
            shallow: true,
          })
          const aiSrcDir = joinPath(tempDir, 'ai', aiInstruction)

          let aiDestDir = themeRoot

          if (aiInstruction !== 'claude') {
            aiDestDir = joinPath(themeRoot, `.${aiInstruction}`)
          }

          try {
            await copyDirectoryContents(aiSrcDir, aiDestDir)
          } catch (error) {
            throw new AbortError('Failed to create AI instructions')
          }
        })
      },
    },
  ])
}
