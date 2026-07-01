import {AppLinkedInterface, getAppScopes} from '../../../models/app/app.js'

import {logMetadataForLoadedContext} from '../../context.js'

import {Organization, OrganizationApp} from '../../../models/organization.js'
import {patchEnvFile, parse} from '@shopify/cli-kit/node/dot-env'
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

  if (await fileExists(envFile)) {
    const envFileContent = await readFile(envFile)
    const updatedEnvFileContent = patchEnvFile(envFileContent, updatedValues)

    if (updatedEnvFileContent === envFileContent) {
      return outputContent`No changes to ${outputToken.path(envFile)}`
    } else {
      await writeFile(envFile, updatedEnvFileContent)

      const maskedUpdatedValues = {
        ...updatedValues,
        SHOPIFY_API_SECRET: outputToken.mask(updatedValues.SHOPIFY_API_SECRET ?? '').value,
      }

      const currentEnvValues = parse(envFileContent)
      const maskedCurrentValues = {
        ...currentEnvValues,
        SHOPIFY_API_SECRET: outputToken.mask(currentEnvValues.SHOPIFY_API_SECRET ?? '').value,
      }

      const maskedEnvFileContent = patchEnvFile(envFileContent, maskedUpdatedValues)
      const maskedOldEnvFileContent = patchEnvFile(envFileContent, maskedCurrentValues)

      const diff = diffLines(maskedOldEnvFileContent, maskedEnvFileContent)
      return outputContent`Updated ${outputToken.path(envFile)} to be:

${maskedEnvFileContent}

Here's what changed:

${outputToken.linesDiff(diff)}
  `
    }
  } else {
    const newEnvFileContent = patchEnvFile(null, updatedValues)

    await writeFile(envFile, newEnvFileContent)

    const maskedUpdatedValues = {
      ...updatedValues,
      SHOPIFY_API_SECRET: outputToken.mask(updatedValues.SHOPIFY_API_SECRET ?? '').value,
    }
    const maskedNewEnvFileContent = patchEnvFile(null, maskedUpdatedValues)

    return outputContent`Created ${outputToken.path(envFile)}:

${maskedNewEnvFileContent}
`
  }
}
