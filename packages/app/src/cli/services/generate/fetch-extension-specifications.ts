import {loadThemeSpecifications, loadUIExtensionSpecifications} from '../../models/extensions/specifications.js'
import {UIExtensionSpec} from '../../models/extensions/ui.js'
import {ThemeExtensionSpec} from '../../models/extensions/theme.js'
import {ExtensionFlavor, GenericSpecification} from '../../models/app/extensions.js'
import {
  ExtensionSpecificationsQuery,
  ExtensionSpecificationsQuerySchema,
  FlattenedRemoteSpecification,
} from '../../api/graphql/extension_specifications.js'
import {
  TemplateSpecification,
  TemplateSpecificationsQuery,
  TemplateSpecificationsQuerySchema,
} from '../../api/graphql/template_specifications.js'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {Config} from '@oclif/core'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

type ExtensionSpec = UIExtensionSpec | ThemeExtensionSpec

export interface FetchSpecificationsOptions {
  token: string
  apiKey: string
  config: Config
}
/**
 * Returns all extension/function specifications the user has access to.
 * This includes:
 * - UI extensions
 * - Theme extensions
 * - Functions
 *
 * Will return a merge of the local and remote specifications (remote values override local ones)
 * Will only return the specifications that are also defined locally
 * (Functions are not validated againts remote specifications, gated access is defined locally)
 *
 * @param token - Token to access partners API
 * @returns List of extension specifications
 */
export async function fetchSpecifications({
  token,
  apiKey,
  config,
}: FetchSpecificationsOptions): Promise<GenericSpecification[]> {
  const result: ExtensionSpecificationsQuerySchema = await partnersRequest(ExtensionSpecificationsQuery, token, {
    api_key: apiKey,
  })

  const extensionSpecifications: FlattenedRemoteSpecification[] = result.extensionSpecifications
    .filter((specification) => specification.options.managementExperience === 'cli')
    .map((spec) => {
      const newSpec = spec as FlattenedRemoteSpecification
      // WORKAROUND: The identifiers in the API are different for these extensions to the ones the CLI
      // has been using so far. This is a workaround to keep the CLI working until the API is updated.
      if (spec.identifier === 'theme_app_extension') spec.identifier = 'theme'
      if (spec.identifier === 'subscription_management') spec.identifier = 'product_subscription'
      newSpec.registrationLimit = spec.options.registrationLimit
      newSpec.surface = spec.features?.argo?.surface

      // Hardcoded value for the post purchase extension because the value is wrong in the API
      if (spec.identifier === 'checkout_post_purchase') newSpec.surface = 'post_purchase'

      return newSpec
    })

  const ui = await loadUIExtensionSpecifications(config)
  const theme = await loadThemeSpecifications()
  const local = [...ui, ...theme]

  const updatedSpecs = mergeLocalAndRemoteSpecs(local, extensionSpecifications)
  return [...updatedSpecs, ...(await loadTemplateSpecifications(token))]
}

function mergeLocalAndRemoteSpecs(
  local: ExtensionSpec[],
  remote: FlattenedRemoteSpecification[],
): GenericSpecification[] {
  const updated = local.map((spec) => {
    const remoteSpec = remote.find((remote) => remote.identifier === spec.identifier)
    if (remoteSpec) return {...spec, ...remoteSpec}
    return undefined
  })

  return getArrayRejectingUndefined<GenericSpecification>(updated)
}

export async function loadTemplateSpecifications(token: string): Promise<GenericSpecification[]> {
  const result: TemplateSpecificationsQuerySchema = await partnersRequest(TemplateSpecificationsQuery, token)
  // const templates = result.templateSpecifications
  const templates = fakeTemplateSpecificationResponse

  const enrichedTemplates = templates.map((templateSpec: TemplateSpecification) => {
    const supportedFlavors: ExtensionFlavor[] = templateSpec.types.flatMap((type) => type.supportedFlavors)
    return {
      ...templateSpec,
      externalIdentifier: templateSpec.identifier,
      externalName: templateSpec.name,
      gated: false,
      registrationLimit: 10,
      supportedFlavors,
      group: templateSpec.category,
      category: () => 'template',
      templateURL: templateSpec.url,
      templatePath: (flavor: string) => {
        const supportedFlavor = supportedFlavors.find((supportedFlavor) => supportedFlavor.value === flavor)
        if (!supportedFlavor) return undefined
        return supportedFlavor.path
      },
    }
  })
  return enrichedTemplates
}

// REMOVE THIS
const fakeTemplateSpecificationResponse: TemplateSpecification[] = [
  {
    identifier: 'order_discount',
    name: 'Function - Order discount',
    category: 'Discounts and checkout',
    supportLinks: ['https://shopify.dev/docs/apps/discounts'],
    url: 'https://github.com/Shopify/function-examples',
    types: [
      {
        type: 'order_discount',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Javascript',
            value: 'vanilla-js',
            path: 'discounts/javascript/product-discounts/default',
          },
          {
            name: 'TypeScript',
            value: 'typescript',
            path: 'discounts/javascript/product-discounts/default',
          },
          {
            name: 'Rust',
            value: 'rust',
            path: 'discounts/rust/order-discounts/default',
          },
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'discounts/wasm/order-discounts/default',
          },
        ],
      },
    ],
  },
  {
    identifier: 'cart_checkout_validation',
    name: 'Function - Cart and Checkout Validation',
    category: 'Discounts and checkout',
    supportLinks: ['https://shopify.dev/docs/api/functions/reference/cart-checkout-validation'],
    url: 'https://github.com/Shopify/function-examples',
    types: [
      {
        type: 'cart_checkout_validation',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Rust',
            value: 'rust',
            path: 'checkout/rust/cart-checkout-validation/default',
          },
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'checkout/wasm/cart-checkout-validation/default',
          },
        ],
      },
    ],
  },
  {
    identifier: 'cart_transform',
    name: 'Function - Cart transformer',
    category: 'Discounts and checkout',
    supportLinks: [],
    url: 'https://github.com/Shopify/function-examples',
    types: [
      {
        type: 'cart_checkout_validation',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Rust',
            value: 'rust',
            path: 'checkout/rust/cart-transform/bundles',
          },
        ],
      },
    ],
  },
  {
    identifier: 'delivery_customization.',
    name: 'Function - Delivery customization',
    category: 'Discounts and checkout',
    supportLinks: [],
    url: 'https://github.com/Shopify/function-examples',
    types: [
      {
        type: 'delivery_customization.',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Rust',
            value: 'rust',
            path: 'checkout/rust/delivery-customization/default',
          },
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'checkout/wasm/delivery-customization/default',
          },
        ],
      },
    ],
  },
  {
    identifier: 'payment_customization',
    name: 'Function - Payment customization',
    category: 'Discounts and checkout',
    supportLinks: [],
    url: 'https://github.com/Shopify/function-examples',
    types: [
      {
        type: 'payment_customization',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Rust',
            value: 'rust',
            path: 'checkout/rust/payment-customization/default',
          },
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'checkout/wasm/payment-customization/default',
          },
        ],
      },
    ],
  },
  {
    identifier: 'product_discounts',
    name: 'Function - Product discount',
    category: 'Discounts and checkout',
    supportLinks: ['https://shopify.dev/docs/apps/discounts'],
    url: 'https://github.com/Shopify/function-examples',
    types: [
      {
        type: 'product_discounts',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Javascript',
            value: 'vanilla-js',
            path: 'discounts/javascript/product-discounts/default',
          },
          {
            name: 'TypeScript',
            value: 'typescript',
            path: 'discounts/javascript/product-discounts/default',
          },
          {
            name: 'Rust',
            value: 'rust',
            path: 'discounts/rust/product-discounts/default',
          },
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'discounts/wasm/product-discounts/default',
          },
        ],
      },
    ],
  },
  {
    identifier: 'shipping_discounts',
    name: 'Function - Shipping discount',
    category: 'Discounts and checkout',
    supportLinks: ['https://shopify.dev/docs/apps/discounts'],
    url: 'https://github.com/Shopify/function-examples',
    types: [
      {
        type: 'shipping_discounts',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Javascript',
            value: 'vanilla-js',
            path: 'discounts/javascript/shipping-discounts/default',
          },
          {
            name: 'TypeScript',
            value: 'typescript',
            path: 'discounts/javascript/shipping-discounts/default',
          },
          {
            name: 'Rust',
            value: 'rust',
            path: 'discounts/rust/shipping-discounts/default',
          },
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'discounts/wasm/shipping-discounts/default',
          },
        ],
      },
    ],
  },
]
