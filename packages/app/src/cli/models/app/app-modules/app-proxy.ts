import {AppModule, EncodeContext} from '../app-module.js'
import {BaseSchemaWithoutHandle} from '../../extensions/schemas.js'
import {prependApplicationUrl} from '../../extensions/specifications/validation/url_prepender.js'
import {removeTrailingSlash} from '../../extensions/specifications/validation/common.js'
import {validateRelativeUrl} from '../../app/validation/common.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppProxyTomlSchema = BaseSchemaWithoutHandle.extend({
  app_proxy: zod
    .object({
      url: zod.preprocess(
        removeTrailingSlash as (arg: unknown) => unknown,
        validateRelativeUrl(zod.string({invalid_type_error: 'Value must be string'})),
      ),
      subpath: zod.string({invalid_type_error: 'Value must be a string'}),
      prefix: zod.string({invalid_type_error: 'Value must be a string'}),
    })
    .optional(),
})

type AppProxyToml = zod.infer<typeof AppProxyTomlSchema>

interface AppProxyContract {
  url?: string
  subpath?: string
  prefix?: string
}

class AppProxyModule extends AppModule<AppProxyToml, AppProxyContract> {
  constructor() {
    super({identifier: 'app_proxy', uidStrategy: 'single', tomlKeys: ['app_proxy']})
  }

  async encode(toml: AppProxyToml, context: EncodeContext) {
    if (!toml.app_proxy) return {}

    let appUrl: string | undefined
    if ('application_url' in context.appConfiguration) {
      appUrl = (context.appConfiguration as {application_url?: string}).application_url
    }

    return {
      url: prependApplicationUrl(toml.app_proxy.url, appUrl),
      subpath: toml.app_proxy.subpath,
      prefix: toml.app_proxy.prefix,
    }
  }

  decode(contract: AppProxyContract) {
    if (!contract.url) return {} as AppProxyToml
    return {
      app_proxy: {
        url: removeTrailingSlash(contract.url),
        subpath: contract.subpath ?? '',
        prefix: contract.prefix ?? '',
      },
    } as AppProxyToml
  }
}

export const appProxyModule = new AppProxyModule()
