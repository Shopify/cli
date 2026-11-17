import {AppLinkedInterface, getAppScopes} from '../../../models/app/app.js'

import {logMetadataForLoadedContext} from '../../context.js'

import {
  Organization,
  OrganizationApp,
  fetchAppClientSecret,
  warnClientSecretOmitted,
} from '../../../models/organization.js'
import {patchEnvFile} from '@shopify/cli-kit/node/dot-env'
import {diffLines} from 'diff'
import {fileExists, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {OutputMessage, outputContent, outputToken} from '@shopify/cli-kit/node/output'

interface PullEnvOptions {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  organization: Organization
  envFile: string
}

export async function pullEnv({app, remoteApp, organization, envFile}: PullEnvOptions): Promise<OutputMessage> {
  await logMetadataForLoadedContext(remoteApp, organization.source)
  const apiSecret = await fetchAppClientSecret(remoteApp)
  if (!apiSecret) warnClientSecretOmitted()

  const updatedValues = {
    SHOPIFY_API_KEY: remoteApp.apiKey,
    // Without a secret, the file keeps its current value, so pulling never blanks a local secret.
    ...(apiSecret ? {SHOPIFY_API_SECRET: apiSecret} : {}),
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
