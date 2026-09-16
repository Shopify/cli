import {createContractBasedModuleSpecification} from '../specification.js'
import {BaseConfigType} from '../schemas.js'

interface FlowTriggerLifecycleCallbackConfig extends BaseConfigType {
  url: string
}

const flowTriggerLifecycleCallbackSpec = createContractBasedModuleSpecification<FlowTriggerLifecycleCallbackConfig>({
  identifier: 'flow_trigger_lifecycle_callback',
  uidStrategy: 'uuid',
  experience: 'extension',
  appModuleFeatures: () => [],
  appRelativeUrlFields: ['url'],
})

export default flowTriggerLifecycleCallbackSpec
