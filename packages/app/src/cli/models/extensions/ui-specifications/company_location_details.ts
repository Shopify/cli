import {getDependencyVersion} from '../../app/app.js'
import {createUIExtensionSpecification} from '../ui.js'
import {BaseUIExtensionSchema} from '../schemas.js'
import {BugError} from '@shopify/cli-kit/node/error'

const dependency = {name: '@shopify/admin-ui-extensions-react', version: 'latest'}

const spec = createUIExtensionSpecification({
  identifier: 'company_location_details',
  surface: 'admin',
  dependency,
  partnersWebIdentifier: 'company_location_details',
  schema: BaseUIExtensionSchema,
  deployConfig: async (_, directory) => {
    console.log("deploy config");
    const result = await getDependencyVersion(dependency.name, directory)
    console.log(`comp loc result=${result}`)
    if (result === 'not_found') throw new BugError('Dependency @shopify/admin-ui-extensions-react not found')
    return {renderer_version: result?.version}
  },
})

export default spec
