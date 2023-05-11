import {getDependencyVersion} from '../../app/app.js'
import {createUIExtensionSpecification} from '../ui.js'
import {BaseUIExtensionSchema} from '../schemas.js'
import {BugError} from '@shopify/cli-kit/node/error'

const dependency = {name: '@shopify/admin-ui-extensions-react', version: '^1.0.1'}

const spec = createUIExtensionSpecification({
  identifier: 'product_subscription',
  surface: 'admin',
  dependency,
  graphQLType: 'subscription_management',
  partnersWebIdentifier: 'product_subscription',
  schema: BaseUIExtensionSchema,
  isPreviewable: true,
  deployConfig: async (_, directory) => {
    const result = await getDependencyVersion(dependency.name, directory)
    if (result === 'not_found') throw new BugError('Dependency @shopify/admin-ui-extensions-react not found')
    return {renderer_version: result?.version}
  },
})

export default spec
