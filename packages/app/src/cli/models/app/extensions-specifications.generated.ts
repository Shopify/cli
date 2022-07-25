// automatically generated file
export const extensionSpecifications = [
  {
    name: 'Checkout Post Purchase',
    identifier: 'checkout_post_purchase',
    gated: false,
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
    },
    features: {
      argo: {
        surface: 'checkout',
      },
    },
  },
  {
    name: 'Checkout Extension',
    identifier: 'checkout_ui_extension',
    gated: false,
    options: {
      managementExperience: 'cli',
      registrationLimit: 5,
    },
    features: {
      argo: {
        surface: 'checkout',
      },
    },
  },
  {
    name: 'Product Subscription',
    identifier: 'subscription_management',
    gated: false,
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
    },
    features: {
      argo: {
        surface: 'admin',
      },
    },
  },
  {
    name: 'Web Pixel Extension',
    identifier: 'web_pixel_extension',
    gated: true,
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
    },
    features: {
      argo: null,
    },
  },
  {
    name: 'Online Store - App Theme Extension',
    identifier: 'theme_app_extension',
    gated: false,
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
    },
    features: {
      argo: null,
    },
  },
  {
    name: 'POS UI Extension',
    identifier: 'pos_ui_extension',
    gated: true,
    options: {
      managementExperience: 'cli',
      registrationLimit: 10,
    },
    features: {
      argo: {
        surface: 'point_of_sale',
      },
    },
  },
]
