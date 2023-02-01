import {Command} from './Command.js'
import {Link} from './Link.js'
import {List} from './List.js'
import {UserInput} from './UserInput.js'
import {FilePath} from './FilePath.js'
import {Subdued} from './Subdued.js'
import {Box, Text} from 'ink'
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

interface SubduedToken {
  subdued: string
}

interface FilePathToken {
  filePath: string
}

interface ListToken {
  list: {
    title?: string
    items: TokenItem[]
    ordered?: boolean
  }
}

interface BoldToken {
  bold: string
}

type Token =
  | string
  | CommandToken
  | LinkToken
  | CharToken
  | UserInputToken
  | SubduedToken
  | FilePathToken
  | ListToken
  | BoldToken
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

export function tokenItemToString(token: TokenItem): string {
  if (typeof token === 'string') {
    return token
  } else if ('command' in token) {
    return token.command
  } else if ('link' in token) {
    return token.link.label || token.link.url
  } else if ('char' in token) {
    return token.char
  } else if ('userInput' in token) {
    return token.userInput
  } else if ('subdued' in token) {
    return token.subdued
  } else if ('filePath' in token) {
    return token.filePath
  } else if ('list' in token) {
    return token.list.items.map(tokenItemToString).join(' ')
  } else if ('bold' in token) {
    return token.bold
  } else {
    return token.map(tokenItemToString).join(' ')
  }
}

export function appendToTokenItem(token: TokenItem, suffix: string): TokenItem {
  return Array.isArray(token) ? [...token, suffix] : [token, suffix]
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
  } else if ('subdued' in item) {
    return <Subdued subdued={item.subdued} />
  } else if ('filePath' in item) {
    return <FilePath filePath={item.filePath} />
  } else if ('list' in item) {
    return <List {...item.list} />
  } else if ('bold' in item) {
    return <Text bold>{item.bold}</Text>
  } else {
    const groupedItems = item.map(tokenToBlock).reduce(splitByDisplayType, [])

    return (
      <Box flexDirection="column">
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
            return <List key={groupIndex} {...(items[0]!.value as ListToken).list} />
          }
        })}
      </Box>
    )
  }
}

export {TokenizedText}
