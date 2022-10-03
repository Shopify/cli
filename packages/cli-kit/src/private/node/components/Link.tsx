import {Text, Transform} from 'ink'
import React from 'react'
import terminalLink from 'terminal-link'

interface Props {
  url: string
}

const Link: React.FC<Props> = ({url}) => {
  return (
    <Transform transform={(children) => terminalLink(children, url, {fallback: false})}>
      <Text>{url}</Text>
    </Transform>
  )
}

export {Link}
