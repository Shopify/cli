import {renderSelectPrompt, renderWarning, renderTasks} from '@shopify/cli-kit/node/ui'
import {downloadGitRepository, removeGitRemote} from '@shopify/cli-kit/node/git'
import {joinPath} from '@shopify/cli-kit/node/path'
import {rmdir, fileExists, inTemporaryDirectory, readFile, writeFile, symlink} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'

export const SKELETON_THEME_URL = 'https://github.com/Shopify/skeleton-theme.git'
const AI_INSTRUCTIONS_REPO_URL = 'https://github.com/Shopify/theme-liquid-docs.git'

const SUPPORTED_AI_INSTRUCTIONS = {
  all: 'All',
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
    message: 'Which LLM instruction file would you like to include in your theme?',
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
  const createdFiles: string[] = []

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

          const instructions = (
            aiInstruction === 'all'
              ? (Object.keys(SUPPORTED_AI_INSTRUCTIONS).filter((key) => key !== 'all') as AIInstruction[])
              : [aiInstruction]
          ) as Exclude<AIInstruction, 'all'>[]

          try {
            const sourcePath = joinPath(tempDir, 'ai', 'github', 'copilot-instructions.md')
            const sourceContent = await readFile(sourcePath)

            const agentsPath = joinPath(themeRoot, 'AGENTS.md')
            const agentsContent = `# AGENTS.md\n\n${sourceContent}`
            await writeFile(agentsPath, agentsContent)

            const results = await Promise.all(
              instructions.map((instruction) => createAIInstructionFiles(themeRoot, agentsPath, instruction)),
            )

            // Collect files that were copied instead of symlinked
            results.forEach((result) => {
              if (result.copiedFile) {
                createdFiles.push(result.copiedFile)
              }
            })
          } catch (error) {
            throw new AbortError('Failed to create AI instructions')
          }
        })
      },
    },
  ])

  if (createdFiles.length > 0) {
    renderWarning({
      headline: 'Files created instead of symlinks.',
      body: `Shopify CLI attempted to create symbolic links between AGENTS.md and ${createdFiles.join(
        ', ',
      )}, but your system doesn't have Developer Mode enabled or symlinks are disabled. Separate files were created instead.`,
    })
  }
}

export async function createAIInstructionFiles(
  themeRoot: string,
  agentsPath: string,
  instruction: AIInstruction,
): Promise<{copiedFile?: string}> {
  if (instruction === 'cursor') {
    // Cursor natively supports AGENTS.md, so no symlink needed
    return {}
  }

  const symlinkMap = {
    github: 'copilot-instructions.md',
    claude: 'CLAUDE.md',
  } as const

  const symlinkName = symlinkMap[instruction as Exclude<AIInstruction, 'all' | 'cursor'>]
  const symlinkPath = joinPath(themeRoot, symlinkName)

  try {
    await symlink(agentsPath, symlinkPath)
    return {}
  } catch (error) {
    // On Windows, symlinks may require admin privileges or Developer Mode
    // Fall back to copying the file if symlink creation fails
    if (error instanceof Error) {
      const agentsContent = await readFile(agentsPath)
      await writeFile(symlinkPath, agentsContent)
      return {copiedFile: symlinkName}
    } else {
      throw error
    }
  }
}
