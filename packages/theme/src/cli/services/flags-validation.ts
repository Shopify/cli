import {AbortError} from '@shopify/cli-kit/node/error'

/**
 * Validates that a theme password uses the required shptka_ format.
 *
 * Commands like `shopify theme dev`, `shopify theme console`, and
 * `shopify theme profile` require passwords from the Theme Access app or
 * standard authentication, as these commands rely on Storefront APIs that only
 * work with Theme Access authentication.
 *
 * Legacy authentication methods are still supported in `shopify theme pull`
 * and `shopify theme push` for backwards compatibility.
 *
 * @param password - the password to validate
 * @throws AbortError when password doesn't start with 'shptka_'
 */
export function validateThemePassword(password?: string): void {
  if (!password) return

  if (password.startsWith('shptka_')) return

  throw new AbortError('Invalid password. Please generate a new password from the Theme Access app.')
}
