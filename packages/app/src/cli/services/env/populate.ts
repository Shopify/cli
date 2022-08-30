import {selectApp} from '../app/select-app.js'
import {AppInterface} from '../../models/app/app.js'
import {output, file} from '@shopify/cli-kit'
import {patchEnvFile} from '@shopify/cli-kit/node/dot-env'
import {diffLines} from 'diff'

type Format = 'json' | 'text'
interface PopulateEnvOptions {
  noUpdate: boolean
  envFile: string
}

export async function populateEnv(app: AppInterface, {noUpdate, envFile}: PopulateEnvOptions): Promise<output.Message> {
  if (noUpdate) {
    return outputEnv(app, 'text')
  } else {
    return updateEnvFile(app, envFile)
  }
}

export async function updateEnvFile(
  app: AppInterface,
  envFile: PopulateEnvOptions['envFile'],
): Promise<output.Message> {
  const selectedApp = await selectApp()

  const updatedValues = {
    SHOPIFY_API_KEY: selectedApp.apiKey,
    SHOPIFY_API_SECRET: selectedApp.apiSecretKeys[0]?.secret,
    SCOPES: app.configuration.scopes,
  }

  if (await file.exists(envFile)) {
    const envFileContent = await file.read(envFile)
    const updatedEnvFileContent = patchEnvFile(envFileContent, updatedValues)

    if (updatedEnvFileContent === envFileContent) {
      return output.content`No changes to ${output.token.path(envFile)}`
    } else {
      await file.write(envFile, updatedEnvFileContent)

      const diff = diffLines(envFileContent ?? '', updatedEnvFileContent)
      return output.content`Updated ${output.token.path(envFile)} to be:

${updatedEnvFileContent}

Here's what changed:

${output.token.linesDiff(diff)}
  `
    }
  } else {
    const newEnvFileContent = patchEnvFile(null, updatedValues)

    await file.write(envFile, newEnvFileContent)

    return output.content`Created ${output.token.path(envFile)}:

${newEnvFileContent}
`
  }
}

export async function outputEnv(app: AppInterface, format: Format): Promise<output.Message> {
  const selectedApp = await selectApp()

  if (format === 'json') {
    return output.content`${output.token.json({
      SHOPIFY_API_KEY: selectedApp.apiKey,
      SHOPIFY_API_SECRET: selectedApp.apiSecretKeys[0]?.secret,
      SCOPES: app.configuration.scopes,
    })}`
  } else {
    return output.content`
    ${output.token.green('SHOPIFY_API_KEY')}=${selectedApp.apiKey}
    ${output.token.green('SHOPIFY_API_SECRET')}=${selectedApp.apiSecretKeys[0]?.secret ?? ''}
    ${output.token.green('SCOPES')}=${app.configuration.scopes}
  `
  }
}
