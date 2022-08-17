import {AppInterface} from '../models/app/app.js'
import {output} from '@shopify/cli-kit'

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
  //   const token = await session.ensureAuthenticatedPartners()

  //   const orgs = await fetchOrganizations(token)
  //   const org = await selectOrganizationPrompt(orgs)
  //   const {organization, apps} = await fetchOrgAndApps(org.id, token)

  //   const selectedApp = await selectOrCreateApp(app, apps, organization, token)

  //   if (format === 'json') {
  //     return output.content`${output.token.json({
  //       SHOPIFY_API_KEY: selectedApp.apiKey,
  //       SHOPIFY_API_SECRET: selectedApp.apiSecretKeys[0].secret,
  //       SCOPES: app.configuration.scopes,
  //     })}`
  //   } else {
  //     return output.content`
  // Use these environment variables to set up your deployment pipeline for this app:
  //   · ${output.token.green('SHOPIFY_API_KEY')}: ${selectedApp.apiKey}
  //   · ${output.token.green('SHOPIFY_API_SECRET')}: ${selectedApp.apiSecretKeys[0].secret}
  //   · ${output.token.green('SCOPES')}: ${app.configuration.scopes}
  //     `
  return output.content`Updating env file`
}

export async function outputEnv(app: AppInterface): Promise<output.Message> {
  return output.content`Showing env`
}
