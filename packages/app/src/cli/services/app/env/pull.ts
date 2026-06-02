import {AppLinkedInterface, getAppScopes} from '../../../models/app/app.js'

import {logMetadataForLoadedContext} from '../../context.js'

import {Organization, OrganizationApp} from '../../../models/organization.js'
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

  const updatedValues = {
    SHOPIFY_API_KEY: remoteApp.apiKey,
    SHOPIFY_API_SECRET: remoteApp.apiSecretKeys[0]?.secret,
    SCOPES: getAppScopes(app.configuration),
  }

  const redactedValues = {
    ...updatedValues,
    SHOPIFY_API_SECRET: '****',
  }

  if (await fileExists(envFile)) {
    const envFileContent = await readFile(envFile)
    const updatedEnvFileContent = patchEnvFile(envFileContent, updatedValues)

    if (updatedEnvFileContent === envFileContent) {
      return outputContent`No changes to ${outputToken.path(envFile)}`
    } else {
      await writeFile(envFile, updatedEnvFileContent)

      const redactedOldEnvFileContent = patchEnvFile(envFileContent, {SHOPIFY_API_SECRET: '****'})
      const redactedEnvFileContent = patchEnvFile(envFileContent, redactedValues)
      const diff = diffLines(redactedOldEnvFileContent, redactedEnvFileContent)
      return outputContent`Updated ${outputToken.path(envFile)} to be:

${redactedEnvFileContent}

Here's what changed:

${outputToken.linesDiff(diff)}
  `
    }
  } else {
    const newEnvFileContent = patchEnvFile(null, updatedValues)
    const redactedEnvFileContent = patchEnvFile(null, redactedValues)

    await writeFile(envFile, newEnvFileContent)

    return outputContent`Created ${outputToken.path(envFile)}:

${redactedEnvFileContent}
`
  }
}
