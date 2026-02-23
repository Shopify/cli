/**
 * UI Extension — the hardest module. Validates complex encode + localization.
 * Note: This prototype only implements encode(). The full module in Phase 2 would also need
 * validate(), getBundleExtensionStdinContent(), copyStaticAssets(), contributeToSharedTypeFile(),
 * and getDevProcess(). Those are Phase 2 concerns — this prototype validates the encode pattern.
 */

import {AppModule, EncodeContext} from '../app-module.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {joinPath} from '@shopify/cli-kit/node/path'

interface BuildManifest {
  assets: {[key: string]: {filepath: string; module?: string}}
}

interface UIExtensionPoint {
  target: string
  module: string
  metafields?: {namespace: string; key: string}[]
  build_manifest: BuildManifest
  [key: string]: unknown
}

interface UIExtensionToml {
  name: string
  type: string
  api_version?: string
  extension_points?: UIExtensionPoint[]
  capabilities?: unknown
  supported_features?: unknown
  description?: string
  settings?: unknown
  [key: string]: unknown
}

interface UIExtensionContract {
  api_version?: string
  extension_points: UIExtensionPoint[]
  capabilities?: unknown
  supported_features?: unknown
  name: string
  description?: string
  settings?: unknown
  localization: unknown
}

function addDistPathToAssets(extP: UIExtensionPoint): UIExtensionPoint {
  return {
    ...extP,
    build_manifest: {
      ...extP.build_manifest,
      assets: Object.fromEntries(
        Object.entries(extP.build_manifest.assets).map(([key, value]) => [
          key,
          {
            ...value,
            filepath: joinPath('dist', value.filepath),
          },
        ]),
      ),
    },
  }
}

export class UIExtensionModule extends AppModule<UIExtensionToml, UIExtensionContract> {
  constructor() {
    super({identifier: 'ui_extension', uidStrategy: 'uuid'})
  }

  async encode(toml: UIExtensionToml, context: EncodeContext): Promise<UIExtensionContract> {
    const transformedExtensionPoints = toml.extension_points?.map(addDistPathToAssets) ?? []

    return {
      api_version: toml.api_version,
      extension_points: transformedExtensionPoints,
      capabilities: toml.capabilities,
      supported_features: toml.supported_features,
      name: toml.name,
      description: toml.description,
      settings: toml.settings,
      localization: await loadLocalesConfig(context.directory, toml.type),
    }
  }
}

export const uiExtensionModule = new UIExtensionModule()
