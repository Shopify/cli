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

type DisplayType = 'block' | 'inline'
interface Block {
  display: DisplayType
  value: Token
}

function tokenToBlock(token: Token): Block {
  return {
    display: typeof token !== 'string' && 'list' in token ? 'block' : 'inline',
    value: token,
  }
}

function splitByDisplayType(acc: Block[][], item: Block) {
  if (item.display === 'block') {
    acc.push([item])
  } else {
    const last = acc[acc.length - 1]
    if (last && last[0]!.display === 'inline') {
      last.push(item)
    } else {
      acc.push([item])
    }
  }
  return acc
}

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
    const groupedItems = item.map(tokenToBlock).reduce(splitByDisplayType, [])

    return (
      <>
        {groupedItems.map((items, groupIndex) => {
          if (items[0]!.display === 'inline') {
            return (
              <Text key={groupIndex}>
                {items.map((item, itemIndex) => (
                  <Text key={itemIndex}>
                    {itemIndex !== 0 && !(typeof item.value !== 'string' && 'char' in item.value) && <Text> </Text>}
                    <TokenizedText item={item.value} />
                  </Text>
                ))}
              </Text>
            )
          } else {
            return <List key={groupIndex} items={(items[0]!.value as ListToken).list.items} />
          }
        })}
      </>
    )
  }
}

export {TokenizedText}
