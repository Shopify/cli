/**
 * Enum for the differnet APIs the CLI can interact with.
 * @readonly
 */
export type Service = 'shopify' | 'partners' | 'identity'

/**
 * Enum that represents the environment to use for a given service.
 * @readonly
 */
export enum Environment {
  Local = 'local',
  Production = 'production',
  Spin = 'spin',
}
