import {asHumanFriendlyArray} from '@shopify/cli-kit/common/array'
import {renderWarning} from '@shopify/cli-kit/node/ui'

export type PortWarning = (
  | {
      type: 'GraphiQL'
      flag: '--graphiql-port'
    }
  | {
      type: 'localhost'
      flag: '--localhost-port'
    }
) & {
  requestedPort: number
}

export function renderPortWarnings(portWarnings: PortWarning[] = []) {
  if (portWarnings.length === 0 || !portWarnings[0]) return

  if (portWarnings.length === 1) {
    const warning = portWarnings[0]

    renderWarning({
      headline: [`A random port will be used for ${warning.type} because ${warning?.requestedPort} is not available.`],
      body: [
        `If you want to use a specific port, you can choose a different one by setting the `,
        {command: warning?.flag},
        ` flag.`,
      ],
    })
    return
  }

  const formattedWarningTypes = asHumanFriendlyArray(portWarnings.map((warning) => warning.type)).join(' ')
  const formattedFlags = asHumanFriendlyArray(portWarnings.map((warning) => ({command: warning.flag})))

  renderWarning({
    headline: [`Random ports will be used for ${formattedWarningTypes} because the requested ports are not available.`],
    body: [`If you want to use specific ports, you can choose different ports using the`, ...formattedFlags, `flags.`],
  })
}
