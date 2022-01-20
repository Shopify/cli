/**
 * Enum for the differnet APIs the CLI can interact with.
 * @readonly
 * @enum {number}
 */
export enum Service {
  PartnersApi = 1,
  StorefrontRendererApi,
  AdminApi,
  IdentityApi,
}

/**
 * Enum that represents the environment to use for a given service.
 * @readonly
 * @enum {number}
 */
export enum Environment {
  Local = 1,
  Production,
  Spin,
}
