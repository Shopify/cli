import {Command} from './Command.js'
import {Link} from './Link.js'
import {List} from './List.js'
import {UserInput} from './UserInput.js'
import {FilePath} from './FilePath.js'
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

interface UserInputToken {
  userInput: string
}

interface FilePathToken {
  filePath: string
}

interface ListToken {
  list: {
    items: string[]
    ordered?: boolean
  }
}

type Token = string | CommandToken | LinkToken | CharToken | UserInputToken | FilePathToken | ListToken
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
    return <Text>{item}</Text>
  } else if ('command' in item) {
    return <Command command={item.command} />
  } else if ('link' in item) {
    return <Link {...item.link} />
  } else if ('char' in item) {
    return <Text>{item.char[0]}</Text>
  } else if ('userInput' in item) {
    return <UserInput userInput={item.userInput} />
  } else if ('filePath' in item) {
    return <FilePath filePath={item.filePath} />
  } else if ('list' in item) {
    return <List {...item.list} />
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
