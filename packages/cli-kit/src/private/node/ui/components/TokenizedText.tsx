/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {Command} from './Command.js'
import {Link} from './Link.js'
import {List} from './List.js'
import {UserInput} from './UserInput.js'
import {FilePath} from './FilePath.js'
import {Subdued} from './Subdued.js'
import {Box, Text} from 'ink'
import React, {FunctionComponent} from 'react'

export interface CommandToken {
  command: string
}

export interface LinkToken {
  link: {
    label?: string
    url: string
  }
}

export interface CharToken {
  char: string
}

export interface UserInputToken {
  userInput: string
}

export interface SubduedToken {
  subdued: string
}

export interface FilePathToken {
  filePath: string
}

export interface ListToken {
  list: {
    title?: TokenItem<InlineToken>
    items: TokenItem<InlineToken>[]
    ordered?: boolean
  }
}

export interface BoldToken {
  bold: string
}

export interface InfoToken {
  info: string
}

export interface WarnToken {
  warn: string
}

export interface ErrorToken {
  error: string
}

export type Token =
  | string
  | CommandToken
  | LinkToken
  | CharToken
  | UserInputToken
  | SubduedToken
  | FilePathToken
  | ListToken
  | BoldToken
  | InfoToken
  | WarnToken
  | ErrorToken

export type InlineToken = Exclude<Token, ListToken>
export type TokenItem<T extends Token = Token> = T | T[]

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
  } else if ('info' in token) {
    return token.info
  } else if ('warn' in token) {
    return token.warn
  } else if ('error' in token) {
    return token.error
  } else {
    return token
      .map((item, index) => {
        if (index !== 0 && !(typeof item !== 'string' && 'char' in item)) {
          return ` ${tokenItemToString(item)}`
        } else {
          return tokenItemToString(item)
        }
      })
      .join('')
  }
}

export function appendToTokenItem(token: TokenItem, suffix: string): TokenItem {
  return Array.isArray(token) ? [...token, {char: suffix}] : [token, {char: suffix}]
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

const InlineBlocks: React.FC<{blocks: Block[]}> = ({blocks}) => {
  return (
    <Text>
      {blocks.map((block, blockIndex) => (
        <Text key={blockIndex}>
          {blockIndex !== 0 && !(typeof block.value !== 'string' && 'char' in block.value) && <Text> </Text>}
          <TokenizedText item={block.value} />
        </Text>
      ))}
    </Text>
  )
}

interface TokenizedTextProps {
  item: TokenItem
}

/**
 * `TokenizedText` renders a text string with tokens that can be either strings,
 * links, and commands.
 */
const TokenizedText: FunctionComponent<TokenizedTextProps> = ({item}) => {
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
  } else if ('info' in item) {
    return <Text color="blue">{item.info}</Text>
  } else if ('warn' in item) {
    return <Text color="yellow">{item.warn}</Text>
  } else if ('error' in item) {
    return <Text color="red">{item.error}</Text>
  } else {
    const groupedItems = item.map(tokenToBlock).reduce(splitByDisplayType, [])

    return groupedItems.length === 1 && groupedItems[0]!.every((item) => item.display === 'inline') ? (
      <InlineBlocks blocks={groupedItems[0]!} />
    ) : (
      <Box flexDirection="column">
        {groupedItems.map((items, groupIndex) => {
          if (items[0]!.display === 'inline') {
            return <InlineBlocks blocks={items} key={groupIndex} />
          } else {
            return <List key={groupIndex} {...(items[0]!.value as ListToken).list} />
          }
        })}
      </Box>
    )
  }
}

export {TokenizedText}
