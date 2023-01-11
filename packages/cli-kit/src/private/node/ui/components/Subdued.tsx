import {Text} from 'ink'
import chalk from 'chalk'
import React from 'react'

interface Props {
  subdued: string
}

/**
 * `Subdued` displays some text that represents a sub-process
 */
const Subdued: React.FC<Props> = ({subdued}: React.PropsWithChildren<Props>): JSX.Element => {
  return <Text>{chalk.dim(subdued)}</Text>
}

export {Subdued}
