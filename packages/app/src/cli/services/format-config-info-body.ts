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
  const items = [
    ...(org ? [`Org:             ${org}`] : []),
    `App:             ${appName}`,
    ...(devStores ?? []).map((storeUrl) => `Dev store:       ${storeUrl}`),
    ...(updateURLs ? [`Update URLs:     ${updateURLs}`] : []),
    ...(includeConfigOnDeploy === undefined ? [] : [`Include config:  ${includeConfigOnDeploy ? 'Yes' : 'No'}`]),
  ]

  const body: Token[] = [{list: {items}}]

  if (messages && messages.length > 0) {
    const messageTokens = messages.flatMap((message, index) => {
      if (message && message.length > 0) {
        const separator = index === 0 ? '\n' : '\n\n'
        return [separator, ...message]
      }
      return []
    })

    return [...body, ...messageTokens]
  }

  return body
}
