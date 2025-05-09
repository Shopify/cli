import {getDependencyVersion} from '../../app/app.js'
import {createExtensionSpecification} from '../specification.js'
import {BaseSchema, MetafieldSchema} from '../schemas.js'
import {BugError} from '@shopify/cli-kit/node/error'
import {zod} from '@shopify/cli-kit/node/schema'

const dependency = '@shopify/admin-ui-extensions'

const productSubscriptionSpec = createExtensionSpecification({
  identifier: 'product_subscription',
  additionalIdentifiers: ['subscription_management'],
  dependency,
  graphQLType: 'subscription_management',
  schema: BaseSchema.extend({
    metafields: zod.array(MetafieldSchema).optional(),
  }),
  appModuleFeatures: (_) => ['ui_preview', 'bundling', 'esbuild', 'single_js_entry_path'],
  deployConfig: async (_, directory) => {
    const result = await getDependencyVersion(dependency, directory)
    if (result === 'not_found') throw new BugError(`Dependency ${dependency} not found`)
    return {renderer_version: result?.version}
  },
})

export default productSubscriptionSpec
