import {getDependencyVersion} from '../../app/app.js'
import {createUIExtensionSpecification} from '../ui.js'
import {BaseUIExtensionSchema} from '../schemas.js'
import {BugError} from '@shopify/cli-kit/node/error'

const dependency = '@shopify/admin-ui-extensions'

const spec = createUIExtensionSpecification({
  identifier: 'product_subscription',
  surface: 'admin',
  dependency,
  graphQLType: 'subscription_management',
  partnersWebIdentifier: 'product_subscription',
  schema: BaseUIExtensionSchema,
  isPreviewable: true,
  deployConfig: async (_, directory) => {
    const result = await getDependencyVersion(dependency, directory)
    if (result === 'not_found') throw new BugError(`Dependency ${dependency} not found`)
    return {renderer_version: result?.version}
  },
})

export default spec
