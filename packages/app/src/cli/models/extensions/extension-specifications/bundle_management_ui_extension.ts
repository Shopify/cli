import {getDependencyVersion} from '../../app/app.js'
import {createExtensionSpec} from '../extensions.js'
import {BaseExtensionSchema} from '../schemas.js'
import {error} from '@shopify/cli-kit'

const dependency = {name: '@shopify/admin-ui-extensions-react', version: '^1.0.1'}

const spec = createExtensionSpec({
  identifier: 'bundle_management_ui_extension',
  externalIdentifier: 'bundle_management_ui',
  externalName: 'Bundle management UI',
  surface: 'admin',
  dependency,
  partnersWebIdentifier: 'bundle_management_ui_extension',
  schema: BaseExtensionSchema,
  deployConfig: async (_, directory) => {
    const result = await getDependencyVersion(dependency.name, directory)
    if (result === 'not_found') throw new error.Bug('Dependency @shopify/admin-ui-extensions-react not found')
    return {renderer_version: result?.version}
  },
})

export default spec
