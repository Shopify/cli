import {Command} from './Command.js'
import {Link} from './Link.js'
import {Text} from 'ink'
import React from 'react'

interface CommandToken {
  command: string
}

interface LinkToken {
  link: {
    label?: string
    url: string
  }
}

export type TextToken = string | CommandToken | LinkToken
export type TextTokenItem = TextToken | TextToken[]

interface Props {
  item: TextToken | TextToken[]
}

/**
 * `TokenizedText` renders a text string with tokens that can be either strings,
 * links, and commands.
 */
const TokenizedText: React.FC<Props> = ({item}) => {
  if (typeof item === 'string') {
    return <Text dimColor>{item}</Text>
  } else if ('command' in item) {
    return <Command command={item.command} />
  } else if ('link' in item) {
    return <Link {...item.link} />
  } else {
    return (
      <Text>
        {item.map((listItem, index) => (
          <Text key={index}>
            <TokenizedText item={listItem} />
            {index < item.length - 1 && <Text> </Text>}
          </Text>
        ))}
      </Text>
    )
  }
}

export {TokenizedText}
