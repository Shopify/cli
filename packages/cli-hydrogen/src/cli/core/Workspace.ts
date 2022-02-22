import {loadConfig, LoadConfigOptions} from 'unconfig'

type ConfigKey = 'eslint' | 'shopify'

export class Workspace {
  loadConfig<T = any>(key: ConfigKey) {
    const options: LoadConfigOptions<T> = {sources: []}
    switch (key) {
      case 'eslint':
        options.sources = []
        break
      case 'shopify':
        options.sources = [
          {
            files: 'shopify.config',
          },
        ]
        break
    }
    return loadConfig<T>(options)
  }
}
