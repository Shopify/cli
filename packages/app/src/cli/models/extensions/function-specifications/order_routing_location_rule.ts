import {createFunctionSpec} from '../functions.js'

const spec = createFunctionSpec({
  identifier: 'order_routing_location_rule',
  externalIdentifier: 'order_routing_location_rule',
  externalName: 'Order routing location rule',
  gated: true,
  templatePath: (lang) => `order-routing/${lang}/rankers/default`,
})

export default spec
