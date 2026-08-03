/**
 * Redacts the copy of the analytics payload that gets printed.
 *
 * The payload itself is already sanitized for Monorail. This is the extra pass for
 * the `outputDebug` sinks that `--verbose` turns on, where the audience is a
 * terminal and whatever scrapes it rather than a sensitive Monorail field.
 *
 * `key` is the whole reason this exists. It marks a credential in the environment
 * -- SHOPIFY_PROXY_KEY holds a signed token, SHOPIFY_FLAG_GRAPHIQL_KEY is derived
 * from the app secret -- but `api_key` is an app's public client ID that Monorail
 * is meant to receive, so the payload rules leave the name alone.
 *
 * @param payload - The already-sanitized analytics payload.
 * @returns A copy with the values of `key`-named entries replaced.
 */
export function redactForOutput<T>(payload: T): T {
  const payloadString = JSON.stringify(payload)
  return JSON.parse(payloadString.replace(/([\w.-]*key[\w.-]*\\*":\\*")[^"\\]*/gi, '$1*****'))
}
