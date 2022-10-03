import {Text, Transform} from 'ink'
import React from 'react'
import terminalLink from 'terminal-link'

interface Props {
  url: string
  label: string
  dimLabelColor?: boolean
}

/**
 * `Link` displays a clickable link when supported by the terminal.
 *
 * @param {React.PropsWithChildren<Props>} props
 * @returns {JSX.Element}
 */
const Link: React.FC<Props> = ({url, label, dimLabelColor = true}: React.PropsWithChildren<Props>): JSX.Element => {
  return (
    <>
      <Text dimColor={dimLabelColor}>{`${label}: `}</Text>
      <Transform transform={(children) => terminalLink(children, url, {fallback: false})}>
        <Text underline>{url}</Text>
      </Transform>
    </>
  )
}

export {Link}
