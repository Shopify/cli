import {Abort} from '../error';
import {warning as outputWarning} from '../output';

import {
  partners as partnersEnvironment,
  shopify as shopifyEnvironment,
  identity as identityEnvironment,
} from './service';
import {isSpin, fqdn as spinFqdn} from './spin';
/**
 * It returns the Partners' API service we should interact with.
 * @returns {string} Fully-qualified domain of the partners service we should interact with.
 */
export async function partners(): Promise<string> {
  const environment = partnersEnvironment();
  const productionFqdn = 'partners.shopify.com';
  switch (environment) {
    case 'local':
      return 'partners.myshopify.io';
    case 'spin':
      if (isSpin()) {
        const fqdn = await spinFqdn();
        return `partners.${fqdn}`;
      } else {
        throw new Abort(
          "Couldn't obtain the Spin FQDN for Partners when the CLI is not running from a Spin environment.",
        );
      }
    default:
      return productionFqdn;
  }
}

/**
 * It returns the Identity service we should interact with.
 * @returns {string} Fully-qualified domain of the Identity service we should interact with.
 */
export async function identity(): Promise<string> {
  const environment = identityEnvironment();
  const productionFqdn = 'accounts.shopify.com';
  switch (environment) {
    case 'local':
      return 'identity.myshopify.io';
    case 'spin':
      if (isSpin()) {
        const fqdn = await spinFqdn();
        return `identity.${fqdn}`;
      } else {
        throw new Abort(
          "Couldn't obtain the Spin FQDN for Identity when the CLI is not running from a Spin environment.",
        );
      }
    default:
      return productionFqdn;
  }
}

/**
 * It returns the Shopify service we should interact with.
 * Note the same fqdn is sued for the Admin and the Storefront Renderer APIs.
 * @returns {string} Fully-qualified domain of the Shopify service we should interact with.
 */
export async function shopify(
  options: {storeFqdn?: string} = {},
): Promise<string> {
  const environment = shopifyEnvironment();
  switch (environment) {
    case 'local':
      return 'shopify.myshopify.io';
    case 'spin':
      if (isSpin()) {
        const fqdn = await spinFqdn();
        return `identity.${fqdn}`;
      } else {
        throw new Abort(
          "Couldn't obtain the Spin FQDN for Shopify when the CLI is not running from a Spin environment.",
        );
      }
    default:
      if (options.storeFqdn) {
        return options.storeFqdn;
      } else {
        throw new Abort(
          "Couldn't obtain the Shopify FQDN because the store FQDN was not provided.",
        );
      }
  }
}
