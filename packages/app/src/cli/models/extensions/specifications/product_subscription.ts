import {getDependencyVersion} from '../../app/app.js'
import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {BugError} from '@shopify/cli-kit/node/error'

const dependency = '@shopify/admin-ui-extensions'

const spec = createExtensionSpecification({
  identifier: 'product_subscription',
  surface: 'admin',
  dependency,
  graphQLType: 'subscription_management',
  partnersWebIdentifier: 'product_subscription',
  schema: BaseSchema,
  isPreviewable: true,
  appModuleFeatures: (_) => ['ui_legacy', 'bundling'],
  deployConfig: async (_, directory) => {
    const result = await getDependencyVersion(dependency, directory)
    if (result === 'not_found') throw new BugError(`Dependency ${dependency} not found`)
    return {renderer_version: result?.version}
  },
})

export default spec
