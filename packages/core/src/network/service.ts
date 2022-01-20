import {
  adminApiEnvironment,
  partnersApiEnvironment,
  storefrontRendererApiEnvironment,
} from 'environment';
import {AbortError, BugError} from 'errors';

/**
 * Enum for the differnet APIs the CLI can interact with.
 * @readonly
 * @enum {number}
 */
export enum Service {
  PartnersApi = 'partners-api',
  StorefrontRendererApi = 'storefront-renderer-api',
  AdminApi = 'admin-api',
  IdentityApi = 'identity-api',
}

/**
 * Enum that represents the environment to use for a given service.
 * @readonly
 * @enum {number}
 */
export enum Environment {
  Local = 'local',
  Production = 'production',
  Spin = 'spin',
}
