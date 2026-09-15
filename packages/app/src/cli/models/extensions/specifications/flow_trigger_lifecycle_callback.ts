import {createContractBasedModuleSpecification} from '../specification.js'

const flowTriggerLifecycleCallbackSpec = createContractBasedModuleSpecification({
  identifier: 'flow_trigger_lifecycle_callback',
  uidStrategy: 'uuid',
  experience: 'extension',
  appModuleFeatures: () => [],
  appRelativeUrlFields: ['url'],
})

export default flowTriggerLifecycleCallbackSpec
