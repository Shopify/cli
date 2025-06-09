import {renderSelectPrompt, renderTasks} from '@shopify/cli-kit/node/ui'
import {downloadGitRepository, removeGitRemote} from '@shopify/cli-kit/node/git'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {fetch} from '@shopify/cli-kit/node/http'

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
        await removeGitRemote(destination)
      },
    },
  ])
}

export async function promptAndCreateAIFile(destination: string) {
  const aiChoice = await renderSelectPrompt({
    message: 'Set up AI dev support?',
    choices: [
      {label: 'VSCode (GitHub Copilot)', value: 'vscode'},
      {label: 'Cursor', value: 'cursor'},
      {label: 'Skip', value: 'none'},
    ],
  })

  const aiFileUrl = 'https://raw.githubusercontent.com/Shopify/theme-liquid-docs/main/ai/liquid.mdc'

  switch (aiChoice) {
    case 'vscode': {
      const githubDir = joinPath(destination, '.github')
      await mkdir(githubDir)
      const aiFilePath = joinPath(githubDir, 'copilot-instructions.md')
      await downloadAndSaveAIFile(aiFileUrl, aiFilePath)
      break
    }
    case 'cursor': {
      const cursorDir = joinPath(destination, '.cursor', 'rules')
      await mkdir(cursorDir)
      const aiFilePath = joinPath(cursorDir, 'liquid.mdc')
      await downloadAndSaveAIFile(aiFileUrl, aiFilePath)
      break
    }
    case 'none':
      // No action required
      break
  }
}

async function downloadAndSaveAIFile(url: string, filePath: string) {
  const response = await fetch(url)
  const content = await response.text()
  await writeFile(filePath, content)
}
