import {selectApp} from '../select-app.js'
import {AppInterface} from '../../../models/app/app.js'
import {output} from '@shopify/cli-kit'
import {patchEnvFile} from '@shopify/cli-kit/node/dot-env'
import {diffLines} from 'diff'
import {fileExists, readFile, writeFile} from '@shopify/cli-kit/node/fs'

interface PullEnvOptions {
  envFile: string
}

export async function pullEnv(app: AppInterface, {envFile}: PullEnvOptions): Promise<output.Message> {
  return updateEnvFile(app, envFile)
}

export async function updateEnvFile(app: AppInterface, envFile: PullEnvOptions['envFile']): Promise<output.Message> {
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
      return output.content`No changes to ${output.token.path(envFile)}`
    } else {
      await writeFile(envFile, updatedEnvFileContent)

      const diff = diffLines(envFileContent ?? '', updatedEnvFileContent)
      return output.content`Updated ${output.token.path(envFile)} to be:

${updatedEnvFileContent}

Here's what changed:

${output.token.linesDiff(diff)}
  `
    }
  } else {
    const newEnvFileContent = patchEnvFile(null, updatedValues)

    await writeFile(envFile, newEnvFileContent)

    return output.content`Created ${output.token.path(envFile)}:

${newEnvFileContent}
`
  }
}
