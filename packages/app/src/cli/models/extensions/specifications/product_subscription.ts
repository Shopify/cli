import {getDependencyVersion} from '../../app/app.js'
import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {BugError} from '@shopify/cli-kit/node/error'

const dependency = '@shopify/admin-ui-extensions'

const productSubscriptionSpec = createExtensionSpecification({
  identifier: 'product_subscription',
  dependency,
  graphQLType: 'subscription_management',
  schema: BaseSchema,
  appModuleFeatures: (_) => ['ui_preview', 'bundling', 'esbuild', 'single_js_entry_path'],
  deployConfig: async (_, directory) => {
    const result = await getDependencyVersion(dependency, directory)
    if (result === 'not_found') throw new BugError(`Dependency ${dependency} not found`)
    return {renderer_version: result?.version}
  },
})

export default productSubscriptionSpec
