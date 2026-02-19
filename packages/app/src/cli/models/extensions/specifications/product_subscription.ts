import {getDependencyVersion} from '../../app/app.js'
import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {ExtensionInstance} from '../extension-instance.js'
import {BugError} from '@shopify/cli-kit/node/error'
import {zod} from '@shopify/cli-kit/node/schema'

const dependency = '@shopify/admin-ui-extensions'

type ProductSubscriptionConfigType = zod.infer<typeof BaseSchema>

const productSubscriptionSpec = createExtensionSpecification({
  identifier: 'product_subscription',
  additionalIdentifiers: ['subscription_management'],
  dependency,
  graphQLType: 'subscription_management',
  schema: BaseSchema,
  appModuleFeatures: (_) => ['ui_preview', 'esbuild', 'single_js_entry_path'],
  buildConfig: {mode: 'ui'},
  getOutputFileName: (extension: ExtensionInstance<ProductSubscriptionConfigType>) => `${extension.handle}.js`,
  getOutputRelativePath: (_extension: ExtensionInstance<ProductSubscriptionConfigType>) => 'dist',
  clientSteps: [
    {
      lifecycle: 'deploy',
      steps: [
        {id: 'bundle-ui', name: 'Bundle UI Extension', type: 'bundle_ui', config: {}},
        {id: 'copy-static-assets', name: 'Copy Static Assets', type: 'copy_static_assets', config: {}},
      ],
    },
  ],
  deployConfig: async (_, directory) => {
    const result = await getDependencyVersion(dependency, directory)
    if (result === 'not_found') throw new BugError(`Dependency ${dependency} not found`)
    return {renderer_version: result?.version}
  },
})

export default productSubscriptionSpec
