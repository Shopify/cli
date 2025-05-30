import {AppLinkedInterface, getAppScopes} from '../../../models/app/app.js'

import {logMetadataForLoadedContext} from '../../context.js'

import {Organization, OrganizationApp} from '../../../models/organization.js'
import {patchEnvFile} from '@shopify/cli-kit/node/dot-env'
import {diffLines} from 'diff'
import {fileExists, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {OutputMessage} from '@shopify/cli-kit/node/output'

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
      return `No changes to ${envFile}`
    } else {
      await writeFile(envFile, updatedEnvFileContent)

      const diff = diffLines(envFileContent ?? '', updatedEnvFileContent)
      const diffString = diff
        .map((part) => {
          if (part.added) {
            return part.value
              .split(/\n/)
              .filter((line) => line !== '')
              .map((line) => `+ ${line}\n`)
          } else if (part.removed) {
            return part.value
              .split(/\n/)
              .filter((line) => line !== '')
              .map((line) => `- ${line}\n`)
          } else {
            return part.value
          }
        })
        .flat()
        .join('')
      return `Updated ${envFile} to be:\n\n${updatedEnvFileContent}\n\nHere's what changed:\n\n${diffString}`
    }
  } else {
    const newEnvFileContent = patchEnvFile(null, updatedValues)

    await writeFile(envFile, newEnvFileContent)

    return `Created ${envFile}:\n\n${newEnvFileContent}\n`
  }
}
