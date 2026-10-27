import {createContractBasedModuleSpecification} from '../specification.js'
import {BaseConfigType} from '../schemas.js'

/** Target of an admin link's optional intent preview companion. */
const ADMIN_LINK_INTENT_PREVIEW_TARGET = 'admin.app.intent-preview.render'

interface AdminLinkConfig extends BaseConfigType {
  targeting?: AdminLinkTargetingEntry[]
}

interface AdminLinkTargetingEntry {
  target?: unknown
  module?: unknown
}

/**
 * Targeting entries that declare a preview module to bundle. A plain admin link
 * declares none, and at most one preview entry is valid per registration.
 */
function previewEntries(config: AdminLinkConfig): {target: string; module: string}[] {
  const targeting = Array.isArray(config.targeting) ? config.targeting : []
  return targeting
    .filter(
      (entry): entry is {target: string; module: string} =>
        typeof entry === 'object' &&
        entry !== null &&
        entry.target === ADMIN_LINK_INTENT_PREVIEW_TARGET &&
        typeof entry.module === 'string',
    )
    .map(({target, module}) => ({target, module}))
}

const adminLinkSpec = createContractBasedModuleSpecification<AdminLinkConfig>({
  identifier: 'admin_link',
  uidStrategy: 'uuid',
  experience: 'extension',
  clientSteps: [
    {
      lifecycle: 'deploy',
      steps: [
        {
          id: 'bundle-admin-link-preview',
          name: 'Bundle Admin Link Preview',
          type: 'bundle_ui',
          config: {generatesAssetsManifest: true, bundleFolder: 'dist/'},
        },
        {
          id: 'include-admin-link-assets',
          name: 'Include Admin Link Assets',
          type: 'include_assets',
          config: {
            generatesAssetsManifest: true,
            inclusions: [
              {
                type: 'configKey',
                anchor: 'targeting[]',
                groupBy: 'target',
                key: 'targeting[].tools',
              },
              {
                type: 'configKey',
                anchor: 'targeting[]',
                groupBy: 'target',
                key: 'targeting[].instructions',
              },
              {
                type: 'configKey',
                anchor: 'targeting[]',
                groupBy: 'target',
                key: 'targeting[].intents[].schema',
              },
            ],
          },
        },
      ],
    },
  ],
  // The preview is a remote DOM target, so its module must register itself through
  // `shopify.extend`. Admin links have no `api_version`, so the API-version heuristic
  // used for ui_extension cannot apply here.
  getBundleExtensionStdinContent: (config) => {
    const previews = previewEntries(config)
    const main = previews
      .map(
        ({target, module}, index) =>
          `import Target_${index} from '${module}';shopify.extend('${target}', (...args) => Target_${index}(...args));`,
      )
      .join('\n')
    return {main}
  },
  // Admin links without a preview produce no bundle, so the output path only
  // exists when a preview module is declared.
  getOutputRelativePath: (extension) => {
    if (previewEntries(extension.configuration).length === 0) return ''
    return `${extension.handle}.js`
  },
  appModuleFeatures: () => ['localization', 'ui_preview'],
})

export default adminLinkSpec
