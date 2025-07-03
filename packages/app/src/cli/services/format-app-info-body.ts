import {Token} from '@shopify/cli-kit/node/ui'

interface FormatAppInfoBodyOptions {
  appName?: string
  appURL?: string
  configPath?: string
  shopFqdn: string
  organizationName?: string
}

/**
 * Returns the body for displaying app information in an Alert.
 *
 * The body tells the user the current app configuration details.
 *
 * @param options - The app information options
 * @returns The formatted body for the Alert component
 *
 * @example
 * ```
 *   • App:             [appName]
 *   • App URL:         [appURL]
 *   • App config:      [configFile]
 *   • Dev store:       [shopFqdn]
 *   • Org:             [organizationName]
 *
 * Press 'i' or 'escape' to close
 * ```
 */
export function formatAppInfoBody({
  appName,
  appURL,
  configPath,
  shopFqdn,
  organizationName,
}: FormatAppInfoBodyOptions): Token[] {
  const items: string[] = []

  if (appName) items.push(`App:             ${appName}`)
  if (appURL) items.push(`App URL:         ${appURL}`)
  if (configPath) items.push(`App config:      ${configPath.split('/').pop()}`)
  items.push(`Dev store:       ${shopFqdn}`)
  if (organizationName) items.push(`Org:             ${organizationName}`)

  const body: Token[] = [{list: {items}}, '\n', '› Press Esc to close']

  return body
}
