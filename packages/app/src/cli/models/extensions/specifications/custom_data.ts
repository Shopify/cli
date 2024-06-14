import {createContractBasedConfigModuleSpecification} from '../specification.js'

export const CustomDataSpecIdentifier = 'data'

const customDataSpec = createContractBasedConfigModuleSpecification(CustomDataSpecIdentifier, 'products', 'metaobjects')

export default customDataSpec
