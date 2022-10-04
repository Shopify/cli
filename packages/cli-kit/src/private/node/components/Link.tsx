import {Text, Transform} from 'ink'
import React from 'react'
import terminalLink from 'terminal-link'

interface Props {
  url: string
  label: string
}

/**
 * `Link` displays a clickable link when supported by the terminal.
 *
 * @param {React.PropsWithChildren<Props>} props
 * @returns {JSX.Element}
 */
const Link: React.FC<Props> = ({url, label}: React.PropsWithChildren<Props>): JSX.Element => {
  return (
    <Text>
      <Text dimColor={true}>{`${label}: `}</Text>
      <Transform transform={(children) => terminalLink(children, url, {fallback: false})}>
        <Text underline>{url}</Text>
      </Transform>
    </Text>
  )
}

export {Link}
