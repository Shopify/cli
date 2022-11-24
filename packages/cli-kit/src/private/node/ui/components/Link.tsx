import chalk from 'chalk'
import {Text} from 'ink'
import React from 'react'
import terminalLink from 'terminal-link'

interface Props {
  url: string
  label?: string
}

/**
 * `Link` displays a clickable link when supported by the terminal.
 */
const Link: React.FC<Props> = ({url, label}: React.PropsWithChildren<Props>): JSX.Element => {
  return <Text>{terminalLink(label ?? url, url, {fallback: (text, url) => `${text} ${chalk.dim(`(${url})`)}`})}</Text>
}

export {Link}
