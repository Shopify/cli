import {Command} from './Command.js'
import {Link} from './Link.js'
import {List} from './List.js'
import {UserInput} from './UserInput.js'
import {FilePath} from './FilePath.js'
import {Subdued} from './Subdued.js'
import {LinksContext} from '../contexts/LinksContext.js'
import React, {FunctionComponent, useContext} from 'react'
import {Box, Text} from 'ink'

export interface LinkToken {
  link: {
    label?: string
    url: string
  }
}

export interface UserInputToken {
  userInput: string
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

export type Token =
  | string
  | {
      command: string
    }
  | LinkToken
  | {
      char: string
    }
  | UserInputToken
  | {
      subdued: string
    }
  | {
      filePath: string
    }
  | ListToken
  | BoldToken
  | {
      info: string
    }
  | {
      warn: string
    }
  | {
      error: string
    }

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
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty label should fall through to url
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

// Matches CommonMark inline links of the form `[label](url)` and autolinks of
// the form `<url>`. We deliberately require an explicit `http://` or
// `https://` scheme on the URL so callers can't accidentally trigger
// linkification by typing square brackets or angle brackets in plain prose.
//
// The URL portion forbids whitespace, the closing delimiter (`)` or `>`), and
// `<` to keep parsing predictable. URLs that legitimately contain those
// characters (e.g. balanced parens) must be percent-encoded by the caller —
// per CommonMark §6.3 / §6.4.
const MARKDOWN_LINK_REGEX = /\[([^[\]]+)\]\((https?:\/\/[^()<>\s]+)\)|<(https?:\/\/[^<>\s]+)>/g

/**
 * Parses an opt-in CommonMark link or autolink from a plain string token and
 * routes the result through the existing `<Link>` component.
 *
 * Why opt-in rather than auto-detection: server-returned error strings can
 * legitimately contain URL-shaped substrings that are not meant to be
 * clickable (e.g. a tunnel-URL validation error echoing back the user's bad
 * input). Requiring the explicit `[label](url)` / `<url>` shape lets the
 * source of the message (server or client) declare intent, and keeps prose
 * with bare URLs untouched.
 *
 * Only invoked when a `LinksContext` is present (i.e. inside a Banner /
 * Alert / FatalError); outside of that, the underlying `<Link>` would render
 * the URL inline and we'd defeat the wrap-resistance the footnote mechanism
 * provides.
 */
function renderStringWithMarkdownLinks(str: string): JSX.Element {
  const matches = Array.from(str.matchAll(MARKDOWN_LINK_REGEX))
  if (matches.length === 0) {
    return <Text>{str}</Text>
  }

  const parts: JSX.Element[] = []
  let cursor = 0
  matches.forEach((match, index) => {
    const start = match.index
    if (start === undefined) {
      return
    }
    const end = start + match[0].length
    if (start > cursor) {
      parts.push(<Text key={`t${index}`}>{str.slice(cursor, start)}</Text>)
    }
    // `[label](url)` captures label in group 1 and url in group 2;
    // `<url>` autolinks capture only the url in group 3.
    const label = match[1]
    const url = match[2] ?? match[3]
    if (url === undefined) {
      return
    }
    parts.push(<Link key={`l${index}`} label={label} url={url} />)
    cursor = end
  })
  if (cursor < str.length) {
    parts.push(<Text key="tail">{str.slice(cursor)}</Text>)
  }
  return <Text>{parts}</Text>
}

/**
 * `TokenizedText` renders a text string with tokens that can be either strings,
 * links, and commands.
 */
const TokenizedText: FunctionComponent<TokenizedTextProps> = ({item}) => {
  const linksContext = useContext(LinksContext)
  if (typeof item === 'string') {
    return linksContext === null ? <Text>{item}</Text> : renderStringWithMarkdownLinks(item)
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
