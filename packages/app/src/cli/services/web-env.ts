import {selectApp} from './app/select-app.js'
import {AppInterface} from '../models/app/app.js'
import {output, file} from '@shopify/cli-kit'
import {patchEnvFile} from '@shopify/cli-kit/node/dot-env'
import {diffLines} from 'diff'

type Format = 'json' | 'text'
interface WebEnvOptions {
  update: boolean
  envFile: string
}

export async function webEnv(app: AppInterface, {update, envFile}: WebEnvOptions): Promise<output.Message> {
  if (update) {
    return updateEnvFile(app, envFile)
  } else {
    return outputEnv(app, 'text')
  }
}

export async function updateEnvFile(app: AppInterface, envFile: WebEnvOptions['envFile']): Promise<output.Message> {
  let envFileContent = null

  if (await file.exists(envFile)) {
    envFileContent = await file.read(envFile)

    output.info(
      output.content`Current ${output.token.path(envFile)} is:

${envFileContent}
`,
    )
  } else {
    output.info(output.content`No environment file found. Creating ${output.token.path(envFile)}`)
  }

  const selectedApp = await selectApp()

  const updatedValues = {
    SHOPIFY_API_KEY: selectedApp.apiKey,
    SHOPIFY_API_SECRET: selectedApp.apiSecretKeys[0].secret,
    SCOPES: app.configuration.scopes,
  }

  const newEnvFileContent = patchEnvFile(envFileContent, updatedValues)

  if (newEnvFileContent === envFileContent) {
    return output.content`No changes to ${output.token.path(envFile)}`
  } else {
    await file.write(envFile, newEnvFileContent)

    const diff = diffLines(envFileContent ?? '', newEnvFileContent, {newlineIsToken: true})
    return output.content`Updated ${output.token.path(envFile)} to be:

${newEnvFileContent}

Here's what changed:
${output.token.linesDiff(diff)}
`
  }
}

export async function outputEnv(app: AppInterface, format: Format): Promise<output.Message> {
  const selectedApp = await selectApp()

  if (format === 'json') {
    return output.content`${output.token.json({
      SHOPIFY_API_KEY: selectedApp.apiKey,
      SHOPIFY_API_SECRET: selectedApp.apiSecretKeys[0].secret,
      SCOPES: app.configuration.scopes,
    })}`
  } else {
    return output.content`
    ${output.token.green('SHOPIFY_API_KEY')}=${selectedApp.apiKey}
    ${output.token.green('SHOPIFY_API_SECRET')}=${selectedApp.apiSecretKeys[0].secret}
    ${output.token.green('SCOPES')}=${app.configuration.scopes}
  `
  }
}
