import {createFunctionSpecification} from '../functions.js'

const spec = createFunctionSpecification({
  identifier: 'shipping_rate_presenter',
  externalIdentifier: 'delivery_option_presenter',
  externalName: 'Delivery option presenter',
  templatePath: (lang) => `checkout/${lang}/shipping-rate-presenter/default`,
  gated: true,
})

export default spec
