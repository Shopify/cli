import chalk from 'chalk'
import {Text} from 'ink'
import React, {FunctionComponent} from 'react'
import terminalLink from 'terminal-link'

interface LinkProps {
  url: string
  label?: string
}

function fallback(text: string, url: string) {
  return `${text} ${chalk.dim(`( ${url} )`)}`
}

/**
 * `Link` displays a clickable link when supported by the terminal.
 */
const Link: FunctionComponent<LinkProps> = ({url, label}): JSX.Element => {
  return <Text>{terminalLink(label ?? url, url, {fallback: label ? fallback : false})}</Text>
}

export {Link}
