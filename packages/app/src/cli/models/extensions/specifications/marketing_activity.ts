import {createContractBasedConfigModuleSpecification} from '../specification.js'

const marketingActivitySpecIdentifier = 'marketing_activity'
const topLevelKeys = [
  'title',
  'description',
  'api_path',
  'tactic',
  'marketing_channel',
  'referring_domain',
  'is_automation',
  'use_external_editor',
  'preview_data',
  'fields',
]
const spec = createContractBasedConfigModuleSpecification(marketingActivitySpecIdentifier, ...topLevelKeys)

export default spec
