import {Bug} from '../error';

import {
  partners as partnersEnvironment,
  shopify as shopifyEnvironment,
  identity as identityEnvironment,
} from './service';
/**
 * It returns the Partners' API service we should interact with.
 * @returns {string} Fully-qualified domain of the partners service we should interact with.
 */
export function partners(): string {
  const environment = partnersEnvironment();
  switch (environment) {
    case 'local':
      return 'partners.myshopify.io';
    case 'production':
      return 'partners.shopify.com';
    case 'spin':
      // TODO
      return `identity.`;
      return '';
    default:
      throw new Bug(
        `Cannot obtain the fqdn for the Partners API environment ${environment}`,
      );
  }
}

/**
 * It returns the Identity service we should interact with.
 * @returns {string} Fully-qualified domain of the Identity service we should interact with.
 */
export function identity(): string {
  const environment = identityEnvironment();
  switch (environment) {
    case 'local':
      return 'identity.myshopify.io';
    case 'production':
      return 'accounts.shopify.com';
    case 'spin':
      // TODO
      return '';
    default:
      throw new Bug(
        `Cannot obtain the fqdn for the Identity environment ${environment}`,
      );
  }
}

/**
 * It returns the Shopify service we should interact with.
 * Note the same fqdn is sued for the Admin and the Storefront Renderer APIs.
 * @returns {string} Fully-qualified domain of the Shopify service we should interact with.
 */
export function shopify(options: {storeFqdn?: string} = {}): string {
  const environment = shopifyEnvironment();
  switch (environment) {
    case 'local':
      return 'shopify.myshopify.io';
    case 'production':
      if (options.storeFqdn) {
        return options.storeFqdn;
      } else {
        return 'storeFqdn';
      }
    case 'spin':
      // TODO
      return '';
    default:
      throw new Bug(
        `Cannot obtain the fqdn for the Identity environment ${environment}`,
      );
  }
}
