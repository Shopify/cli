import {ExtensionUIGroup} from './argo-extension.js'
import {FunctionExtensionConfiguration, FunctionExtensionMetadata} from '../app/extensions.js'
import {path} from '@shopify/cli-kit'

interface FunctionSpecification {
  name: string
  externalName: string
  identifier: string
  externalIdentifier: string
  uiGroup: ExtensionUIGroup
  helpURL?: string
  templateURL?: string
  templatePath: (language: string) => string
}

const ProductDiscountSpecification: FunctionSpecification = {
  name: 'Product Discount',
  externalName: 'Function - Product discount',
  identifier: 'product_discounts',
  externalIdentifier: 'product_discount',
  helpURL: 'https://shopify.dev/apps/subscriptions/discounts',
  uiGroup: 'discounts_and_checkout',
  templateURL: 'https://github.com/Shopify/function-examples',
  templatePath: (lang) => `discounts/${lang}/product-discounts/default`,
}

const OrderDiscountSpecification: FunctionSpecification = {
  name: 'Order Discount',
  externalName: 'Function - Order discount',
  identifier: 'order_discounts',
  externalIdentifier: 'order_discount',
  helpURL: 'https://shopify.dev/apps/subscriptions/discounts',
  uiGroup: 'discounts_and_checkout',
  templatePath: (lang) => `discounts/${lang}/order-discounts/default`,
}

export const allFunctions = [ProductDiscountSpecification, OrderDiscountSpecification]

export class BaseFunction {
  configuration: FunctionExtensionConfiguration
  metadata: FunctionExtensionMetadata
  specification: FunctionSpecification
  directory: string

  constructor(options: {
    directory: string
    configuration: FunctionExtensionConfiguration
    metadata: FunctionExtensionMetadata
    specification: FunctionSpecification
  }) {
    this.directory = options.directory
    this.configuration = options.configuration
    this.metadata = options.metadata
    this.specification = options.specification
  }

  inputQueryPath() {
    return path.join(this.directory, 'input.graphql')
  }

  build() {
    // build function
  }

  validate() {
    // validate function
  }
}

export class OrderDisctount extends BaseFunction {
  specification = OrderDiscountSpecification

  validate() {
    // validate function
  }
}
