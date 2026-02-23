import {AppModule, EncodeContext} from '../app-module.js'
import {WebhooksSchema} from '../../extensions/specifications/app_config_webhook_schemas/webhooks_schema.js'
import {WebhooksConfig} from '../../extensions/specifications/types/app_config_webhook.js'
import {zod} from '@shopify/cli-kit/node/schema'

type WebhooksToml = zod.infer<typeof WebhooksSchema>

interface WebhooksContract {
  api_version?: string
}

class WebhooksModule extends AppModule<WebhooksToml, WebhooksContract> {
  constructor() {
    super({identifier: 'webhooks', uidStrategy: 'single', tomlKeys: ['webhooks']})
  }

  async encode(toml: WebhooksToml, _context: EncodeContext) {
    const webhooks = toml.webhooks as WebhooksConfig | undefined
    if (!webhooks) return {}
    return {api_version: webhooks.api_version}
  }

  decode(contract: WebhooksContract) {
    if (!contract.api_version) return {} as WebhooksToml
    return {webhooks: {api_version: contract.api_version}} as unknown as WebhooksToml
  }
}

export const webhooksModule = new WebhooksModule()
