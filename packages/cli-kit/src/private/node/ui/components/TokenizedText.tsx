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

interface CharToken {
  char: string
}

type Token = string | CommandToken | LinkToken | CharToken
export type TokenItem = Token | Token[]

interface Props {
  item: TokenItem
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
  } else if ('char' in item) {
    return <Text dimColor>{item.char[0]}</Text>
  } else {
    return (
      <Text>
        {item.map((listItem, index) => (
          <Text key={index}>
            {index !== 0 && !(typeof listItem !== 'string' && 'char' in listItem) && <Text> </Text>}
            <TokenizedText item={listItem} />
          </Text>
        ))}
      </Text>
    )
  }
}

export {TokenizedText}
