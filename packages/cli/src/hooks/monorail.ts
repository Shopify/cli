import {buildPayload, buildHeaders, url} from '../services/monorail'
import {Hook} from '@oclif/core'
import {http, output, environment} from '@shopify/cli-kit'

export const hook: Hook.Postrun = async (options) => {
  try {
    const command = options.Command.id.replace(/:/g, ' ')
    const payload = await buildPayload(command, options.argv)
    const body = JSON.stringify(payload)
    const headers = buildHeaders()

    if (environment.local.isProduction()) {
      const response = await http.fetch(url, {method: 'POST', body, headers})
      if (response.status !== 200) {
        throw new Error(response.statusText)
      }
      output.debug(`Analytics event sent: ${body}`)
    } else {
      output.debug(`Analytics event not sent: ${body}`)
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error: unknown) {
    let message = 'Failed to report usage analytics'
    if (error instanceof Error) {
      message += `: ${error.message}`
    }
    output.debug(message)
  }
}
