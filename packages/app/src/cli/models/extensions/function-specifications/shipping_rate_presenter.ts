import {createFunctionSpec} from '../functions.js'

const spec = createFunctionSpec({
  identifier: 'shipping_rate_presenter',
  externalType: 'shipping_discount',
  externalName: 'Delivery option presenter',
  templatePath: (lang) => `checkout/${lang}/shipping-rate-presenter/default`,
  public: false,
})

export default spec
