import {session, output} from '@shopify/cli-kit'
import {selectOrganizationPrompt} from '../prompts/dev'

import {App} from '../models/app/app'
import {fetchOrgAndApps, fetchOrganizations} from './dev/fetch'
import {selectOrCreateApp} from './dev/select-app'

interface EnvOptions {
  app: App
}

export default async function env(options: EnvOptions) {
  const token = await session.ensureAuthenticatedPartners()

  const orgs = await fetchOrganizations(token)
  const org = await selectOrganizationPrompt(orgs)
  const {organization, apps} = await fetchOrgAndApps(org.id, token)

  const selectedApp = await selectOrCreateApp(options.app, apps, organization, token)

  output.newline()
  output.info(
    output.content`Use these environment variables when setting up your deploy of ${output.token.heading(
      selectedApp.title,
    )}:

- ${output.token.green('SHOPIFY_API_KEY')}: ${selectedApp.apiKey}
- ${output.token.green('SHOPIFY_API_SECRET')}: ${selectedApp.apiSecretKeys[0].secret}
- ${output.token.green('SCOPES')}: ${options.app.configuration.scopes}
`,
  )
}
