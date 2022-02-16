/**
 * Enum for the differnet APIs the CLI can interact with.
 * @readonly
 * @enum {number}
 */
export declare enum Service {
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
export declare enum Environment {
  Local = 'local',
  Production = 'production',
  Spin = 'spin',
}
