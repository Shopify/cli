import {createContractBasedModuleSpecification} from '../specification.js'

export const AdminLinkSpecIdentifier = 'admin_link'

const AdminLinkSpec = createContractBasedModuleSpecification(AdminLinkSpecIdentifier, ['localization'])

export default AdminLinkSpec
