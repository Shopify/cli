import {createFunctionSpec} from '../functions.js'

const spec = createFunctionSpec({
  identifier: 'shipping_rate_presenter',
  externalIdentifier: 'delivery_option_presenter',
  externalName: 'Delivery option presenter',
  templatePath: (lang) => `checkout/${lang}/shipping-rate-presenter/default`,
  public: false,
})

export default spec
