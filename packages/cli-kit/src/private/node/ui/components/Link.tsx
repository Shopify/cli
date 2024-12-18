import {LinksContext, ContextValue as LinksContextValue} from '../contexts/LinksContext.js'
import {Text} from 'ink'
import React, {FunctionComponent, useContext} from 'react'
import ansiEscapes from 'ansi-escapes'
import supportsHyperlinks from 'supports-hyperlinks'
import chalk from 'chalk'

interface LinkProps {
  url: string
  label?: string
}

function link(label: string | undefined, url: string, linksContext: LinksContextValue | null) {
  if (!supportsHyperlinks.stdout) {
    if (url === (label ?? url)) {
      return url
    }

    if (linksContext === null) {
      return label ? `${label} ${chalk.dim(`( ${url} )`)}` : url
    }

    const linkId = linksContext.addLink(label, url)
    return `${label ?? url} [${linkId}]`
  }

  return ansiEscapes.link(label ?? url, url)
}

/**
 * `Link` displays a clickable link when supported by the terminal.
 */
const Link: FunctionComponent<LinkProps> = ({label, url}): JSX.Element => {
  const linksContext = useContext(LinksContext)

  return <Text>{link(label, url, linksContext)}</Text>
}

export {Link}
