import {selectApp} from '../select-app.js'
import {AppInterface} from '../../../models/app/app.js'
import * as output from '@shopify/cli-kit/node/output'
import {patchEnvFile} from '@shopify/cli-kit/node/dot-env'
import {diffLines} from 'diff'
import {fileExists, readFile, writeFile} from '@shopify/cli-kit/node/fs'

interface PullEnvOptions {
  envFile: string
}

export async function pullEnv(app: AppInterface, {envFile}: PullEnvOptions): Promise<output.OutputMessage> {
  return updateEnvFile(app, envFile)
}

export async function updateEnvFile(
  app: AppInterface,
  envFile: PullEnvOptions['envFile'],
): Promise<output.OutputMessage> {
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
      return output.outputContent`No changes to ${output.outputToken.path(envFile)}`
    } else {
      await writeFile(envFile, updatedEnvFileContent)

      const diff = diffLines(envFileContent ?? '', updatedEnvFileContent)
      return output.outputContent`Updated ${output.outputToken.path(envFile)} to be:

${updatedEnvFileContent}

Here's what changed:

${output.outputToken.linesDiff(diff)}
  `
    }
  } else {
    const newEnvFileContent = patchEnvFile(null, updatedValues)

    await writeFile(envFile, newEnvFileContent)

    return output.outputContent`Created ${output.outputToken.path(envFile)}:

${newEnvFileContent}
`
  }
}
