import {FlowExtensionSchema} from '../schemas.js'
import {FlowExtensionSpec} from '../flow.js'

/**
 * Extension specification with all properties and methods needed to load a theme extension.
 */
const themeSpecification: FlowExtensionSpec = {
  identifier: 'flow_action_definition',
  // these two fields are going to be overridden by the extension specification API response,
  // but we need them to have a default value for tests
  externalIdentifier: 'flow_action_definition',
  externalName: 'Flow Action Definition Extension',
  supportedFlavors: [],
  registrationLimit: 1,
  gated: false,
  category: () => 'flow' as const,
  partnersWebIdentifier: 'flow_action_definition',
  graphQLType: 'flow_action_definition',
  schema: FlowExtensionSchema,
}

export default themeSpecification
