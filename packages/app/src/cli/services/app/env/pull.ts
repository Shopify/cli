import {AppLinkedInterface, getAppScopes} from '../../../models/app/app.js'

import {logMetadataForLoadedContext} from '../../context.js'

import {OrganizationApp} from '../../../models/organization.js'
import {patchEnvFile} from '@shopify/cli-kit/node/dot-env'
import {diffLines} from 'diff'
import {fileExists, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {OutputMessage, outputContent, outputToken} from '@shopify/cli-kit/node/output'

interface PullEnvOptions {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  envFile: string
}

export async function pullEnv({app, remoteApp, envFile}: PullEnvOptions): Promise<OutputMessage> {
  await logMetadataForLoadedContext(remoteApp)

  const updatedValues = {
    SHOPIFY_API_KEY: remoteApp.apiKey,
    SHOPIFY_API_SECRET: remoteApp.apiSecretKeys[0]?.secret,
    SCOPES: getAppScopes(app.configuration),
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
