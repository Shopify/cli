import {Text} from 'ink'
import React from 'react'

interface Props {
  subdued: string
}

/**
 * `Subdued` displays some text with subdued colors
 */
const Subdued: React.FC<Props> = ({subdued}: React.PropsWithChildren<Props>): JSX.Element => {
  return <Text dimColor>{subdued}</Text>
}

export {Subdued}
