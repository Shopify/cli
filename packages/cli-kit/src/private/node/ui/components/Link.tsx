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
    if (linksContext === null) {
      if (url === (label ?? url)) {
        return url
      }
      return label ? `${label} ${chalk.dim(`( ${url} )`)}` : url
    }

    // Inside a LinksContext, register every link in the footnote table — even
    // ones whose label equals the URL — so the visible label stays compact and
    // the URL is rendered outside the bordered box where it can wrap without
    // being interleaved with `│` characters.
    const linkId = linksContext.addLink(label, url)
    return label ? `${label} [${linkId}]` : `[${linkId}]`
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
