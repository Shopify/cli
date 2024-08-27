import {createContractBasedConfigModuleSpecification} from '../specification.js'

export const CustomDataSpecIdentifier = 'data'

const customDataSpec = createContractBasedConfigModuleSpecification(
  CustomDataSpecIdentifier,
  'product',
  'metaobjects',
  'metafields',
)

export default customDataSpec
