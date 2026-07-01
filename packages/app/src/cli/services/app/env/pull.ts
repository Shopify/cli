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

  if (await fileExists(envFile)) {
    const envFileContent = await readFile(envFile)
    const updatedEnvFileContent = patchEnvFile(envFileContent, updatedValues)

    if (updatedEnvFileContent === envFileContent) {
      return outputContent`No changes to ${outputToken.path(envFile)}`
    } else {
      await writeFile(envFile, updatedEnvFileContent)

      const diff = diffLines(envFileContent ?? '', updatedEnvFileContent)
      const redactedDiff = diff.map((change) => ({
        ...change,
        value: change.value.replace(/^(SHOPIFY_API_SECRET=)(.*)$/gm, '$1******'),
      }))

      const redactedEnvFileContent = updatedEnvFileContent.replace(/^(SHOPIFY_API_SECRET=)(.*)$/gm, '$1******')

      return outputContent`Updated ${outputToken.path(envFile)} to be:

${redactedEnvFileContent}

Here's what changed:

${outputToken.linesDiff(redactedDiff)}
  `
    }
  } else {
    const newEnvFileContent = patchEnvFile(null, updatedValues)

    await writeFile(envFile, newEnvFileContent)

    const redactedEnvFileContent = newEnvFileContent.replace(/^(SHOPIFY_API_SECRET=)(.*)$/gm, '$1******')

    return outputContent`Created ${outputToken.path(envFile)}:

${redactedEnvFileContent}
`
  }
}
