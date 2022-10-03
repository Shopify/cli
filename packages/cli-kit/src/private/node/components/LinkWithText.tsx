import {Link} from './Link.js'
import {Text} from 'ink'
import React from 'react'

interface Props {
  text?: string
  link: {
    label: string
    url: string
  }
}

/**
 * `LinkWithText` displays a link along with some text before it.
 *
 * @param {React.PropsWithChildren<Props>} props
 * @returns {JSX.Element}
 */
const LinkWithText: React.FC<Props> = ({text, link}: React.PropsWithChildren<Props>): JSX.Element => {
  return (
    <Text>
      {text && <Text dimColor>{`${text} `}</Text>}
      <Link url={link.url} label={link.label} dimLabelColor={false} />
    </Text>
  )
}

export {LinkWithText}
