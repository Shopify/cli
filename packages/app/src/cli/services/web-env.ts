import {selectApp} from './dev/select-app.js'
import {AppInterface} from '../models/app/app.js'
import {output, file} from '@shopify/cli-kit'

export type Format = 'json' | 'text'
interface WebEnvOptions {
  update: boolean
  envFile: string
}

export async function webEnv(app: AppInterface, {update, envFile}: WebEnvOptions): Promise<output.Message> {
  if (update) {
    return updateEnvFile(app, {envFile})
  } else {
    return outputEnv(app)
  }
}

export async function updateEnvFile(
  app: AppInterface,
  {envFile}: Pick<WebEnvOptions, 'envFile'>,
): Promise<output.Message> {
  let envFileContent = null

  if (await file.exists(envFile)) {
    envFileContent = await file.read(envFile)

    output.info(`Current ${envFile} is:
${envFileContent}
`)
  } else {
    output.info(`No environment file found. Creating ${envFile}`)
  }

  const selectedApp = await selectApp()

  const updatedValues = {
    SHOPIFY_API_KEY: selectedApp.apiKey,
    SHOPIFY_API_SECRET: selectedApp.apiSecretKeys[0].secret,
    SCOPES: app.configuration.scopes,
  }

  const newEnvFileContent = patchEnvFile(envFileContent, updatedValues)
  await file.write(envFile, newEnvFileContent)

  return output.content`Updated ${envFile} to be:
${newEnvFileContent}
`
}

export async function outputEnv(app: AppInterface): Promise<output.Message> {
  const selectedApp = await selectApp()

  return output.content`
  ${output.token.green('SHOPIFY_API_KEY')}=${selectedApp.apiKey}
  ${output.token.green('SHOPIFY_API_SECRET')}=${selectedApp.apiSecretKeys[0].secret}
  ${output.token.green('SCOPES')}=${app.configuration.scopes}
`
}

function patchEnvFile(envFileContent: string | null, updatedValues: {[key: string]: string}): string {
  const outputLines: string[] = []
  const lines = envFileContent === null ? [] : envFileContent.split('\n')

  const alreadyPresentKeys: string[] = []

  const toLine = (key: string, value: string) => `${key}=${String(value)}`

  for (const line of lines) {
    const match = line.match(/^([^=:#]+?)[=:](.*)/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()

      const newValue = updatedValues[key]

      if (newValue === undefined) {
        outputLines.push(line)
      } else {
        alreadyPresentKeys.push(key)

        if (value === newValue) {
          outputLines.push(line)
        } else {
          const newLine = toLine(key, newValue)
          outputLines.push(newLine)
        }
      }
    } else {
      outputLines.push(line)
    }
  }

  for (const [patchKey, updatedValue] of Object.entries(updatedValues)) {
    if (!alreadyPresentKeys.includes(patchKey)) {
      outputLines.push(toLine(patchKey, updatedValue))
    }
  }

  return outputLines.join('\n')
}
