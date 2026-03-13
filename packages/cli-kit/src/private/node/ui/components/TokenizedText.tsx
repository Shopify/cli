import {Command} from './Command.js'
import {Link} from './Link.js'
import {List} from './List.js'
import {UserInput} from './UserInput.js'
import {FilePath} from './FilePath.js'
import {Subdued} from './Subdued.js'
import React, {FunctionComponent} from 'react'
import {Box, Text} from 'ink'
import type {Token, ListToken, TokenItem} from './token-utils.js'

export type {LinkToken, UserInputToken, ListToken, BoldToken, Token, InlineToken, TokenItem} from './token-utils.js'
export {tokenItemToString} from './token-utils.js'

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
