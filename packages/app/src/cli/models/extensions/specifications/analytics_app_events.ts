import {createContractBasedModuleSpecification} from '../specification.js'

// The platform owns the App Events contract; CLI contributes only this dev-session status message.
const analyticsAppEventsSpec = createContractBasedModuleSpecification({
  identifier: 'analytics_app_events',
  uidStrategy: 'single',
  experience: 'extension',
  appModuleFeatures: () => [],
  getDevSessionUpdateMessages: async () => ['Extension loaded'],
})

export default analyticsAppEventsSpec
