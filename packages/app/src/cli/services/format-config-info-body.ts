import {Token, TokenItem} from '@shopify/cli-kit/node/ui'

interface FormatConfigInfoBodyOptions {
  appName: string
  org?: string
  devStores?: string[]
  updateURLs?: string
  includeConfigOnDeploy?: boolean
  messages?: Token[][]
}

/**
 * Returns the body for a renderInfo().
 *
 * The body tells the user what config is being used for their app.
 *
 * The result should be passed to `renderInfo()` to be displayed in the terminal.
 *
 * @param options - The options to render the info box
 * @returns The body of the info box
 *
 * @example
 * ```
 *   • Org:             [org]
 *   • App:             [appName]
 *   • Dev store:       [devStore[0]] [devStore[1]]
 *   • Update URLs:     [updateURLs]
 *
 * [messages[0]]
 *
 * [messages[1]]
 * ```
 */
export function formatConfigInfoBody({
  appName,
  org,
  devStores,
  updateURLs,
  includeConfigOnDeploy,
  messages,
}: FormatConfigInfoBodyOptions): TokenItem {
  const items = [`App:             ${appName}`]
  if (org) items.unshift(`Org:             ${org}`)
  if (devStores && devStores.length > 0) {
    devStores.forEach((storeUrl) => items.push(`Dev store:       ${storeUrl}`))
  }
  if (updateURLs) items.push(`Update URLs:     ${updateURLs}`)
  if (includeConfigOnDeploy !== undefined) items.push(`Include config:  ${includeConfigOnDeploy ? 'Yes' : 'No'}`)

  let body: Token[] = [{list: {items}}]

  if (messages && messages.length) {
    for (let index = 0; index < messages.length; index++) {
      const message = messages[index]

      if (!message || message.length === 0) continue

      const separator = index === 0 ? '\n' : '\n\n'

      body = body.concat(separator, message)
    }
  }

  return body
}
