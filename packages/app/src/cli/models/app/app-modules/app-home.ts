import {AppModule, EncodeContext} from '../app-module.js'
import {BaseSchemaWithoutHandle} from '../../extensions/schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppHomeTomlSchema = BaseSchemaWithoutHandle.extend({
  application_url: zod.string().url().optional(),
  embedded: zod.boolean().optional(),
  app_preferences: zod
    .object({
      url: zod.string().url().max(255).optional(),
    })
    .optional(),
})

type AppHomeToml = zod.infer<typeof AppHomeTomlSchema>

interface AppHomeContract {
  app_url?: string
  embedded?: boolean
  preferences_url?: string
}

class AppHomeModule extends AppModule<AppHomeToml, AppHomeContract> {
  constructor() {
    super({identifier: 'app_home', uidStrategy: 'single', tomlKeys: ['application_url', 'embedded', 'app_preferences']})
  }

  async encode(toml: AppHomeToml, _context: EncodeContext) {
    return {
      app_url: toml.application_url,
      embedded: toml.embedded,
      preferences_url: toml.app_preferences?.url,
    }
  }

  decode(contract: AppHomeContract) {
    const result: {[key: string]: unknown} = {}
    if (contract.app_url !== undefined) result.application_url = contract.app_url
    if (contract.embedded !== undefined) result.embedded = contract.embedded
    if (contract.preferences_url !== undefined) {
      result.app_preferences = {url: contract.preferences_url}
    }
    return result as AppHomeToml
  }
}

export const appHomeModule = new AppHomeModule()
