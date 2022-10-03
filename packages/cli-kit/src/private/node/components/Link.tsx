import {Text, Transform} from 'ink'
import React from 'react'
import terminalLink from 'terminal-link'

interface Props {
  url: string
}

/**
 * `Link` displays a clickable link when supported by the terminal.
 *
 * @param {React.PropsWithChildren<Props>} props
 * @returns {JSX.Element}
 */
const Link: React.FC<Props> = ({url}: React.PropsWithChildren<Props>): JSX.Element => {
  return (
    <Transform transform={(children) => terminalLink(children, url, {fallback: false})}>
      <Text>{url}</Text>
    </Transform>
  )
}

export {Link}
