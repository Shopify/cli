/**
 * Enum for the differnet APIs the CLI can interact with.
 * @readonly
 * @enum {number}
 */
export type Service = 'shopify' | 'partners' | 'identity' | 'dms'

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
