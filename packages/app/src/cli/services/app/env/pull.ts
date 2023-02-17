import {selectApp} from '../select-app.js'
import {AppInterface} from '../../../models/app/app.js'
import {patchEnvFile} from '@shopify/cli-kit/node/dot-env'
import {diffLines} from 'diff'
import {fileExists, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {OutputMessage, outputContent, outputToken} from '@shopify/cli-kit/node/output'

interface PullEnvOptions {
  envFile: string
}

export async function pullEnv(app: AppInterface, {envFile}: PullEnvOptions): Promise<OutputMessage> {
  return updateEnvFile(app, envFile)
}

export async function updateEnvFile(app: AppInterface, envFile: PullEnvOptions['envFile']): Promise<OutputMessage> {
  const selectedApp = await selectApp()

  const updatedValues = {
    SHOPIFY_API_KEY: selectedApp.apiKey,
    SHOPIFY_API_SECRET: selectedApp.apiSecretKeys[0]?.secret,
    SCOPES: app.configuration.scopes,
  }

  if (await fileExists(envFile)) {
    const envFileContent = await readFile(envFile)
    const updatedEnvFileContent = patchEnvFile(envFileContent, updatedValues)

    if (updatedEnvFileContent === envFileContent) {
      return outputContent`No changes to ${outputToken.path(envFile)}`
    } else {
      await writeFile(envFile, updatedEnvFileContent)

      const diff = diffLines(envFileContent ?? '', updatedEnvFileContent)
      return outputContent`Updated ${outputToken.path(envFile)} to be:

${updatedEnvFileContent}

Here's what changed:

${outputToken.linesDiff(diff)}
  `
    }
  } else {
    const newEnvFileContent = patchEnvFile(null, updatedValues)

    await writeFile(envFile, newEnvFileContent)

    return outputContent`Created ${outputToken.path(envFile)}:

${newEnvFileContent}
`
  }
}
