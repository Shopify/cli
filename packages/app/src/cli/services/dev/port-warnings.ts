import {asHumanFriendlyArray} from '@shopify/cli-kit/common/array'
import {renderWarning} from '@shopify/cli-kit/node/ui'

export type PortDetail = (
  | {
      for: 'GraphiQL'
      flagToRemedy: '--graphiql-port'
    }
  | {
      for: 'localhost'
      flagToRemedy: '--localhost-port'
    }
) & {
  requested: number
  actual: number
}

export function renderPortWarnings(portDetails: PortDetail[]) {
  if (!portDetails.length) return

  const portWarnings = portDetails.filter((warning) => warning.requested !== warning.actual)

  if (portWarnings.length === 0) return

  if (portWarnings.length === 1 && portWarnings[0]) {
    const warning = portWarnings[0]

    renderWarning({
      headline: [`A random port will be used for ${warning.for} because ${warning?.requested} is not available.`],
      body: [
        `If you want to use a specific port, you can choose a different one by setting the `,
        {command: warning?.flagToRemedy},
        ` flag.`,
      ],
    })
    return
  }

  const formattedWarningTypes = asHumanFriendlyArray(portWarnings.map((warning) => warning.for)).join(' ')
  const formattedFlags = asHumanFriendlyArray(portWarnings.map((warning) => ({command: warning.flagToRemedy})))

  renderWarning({
    headline: [`Random ports will be used for ${formattedWarningTypes} because the requested ports are not available.`],
    body: [`If you want to use specific ports, you can choose different ports using the`, ...formattedFlags, `flags.`],
  })
}
