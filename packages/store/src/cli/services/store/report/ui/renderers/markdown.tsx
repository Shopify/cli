import {LeftBarBox} from './callout.js'
import {renderHeadingText} from './heading.js'
import {renderListRow} from './list.js'
import {marked} from 'marked'
import {Box, Text} from 'ink'
import React, {type ReactNode} from 'react'
import type {ComponentRenderProps} from '@json-render/ink'
import type {MarkedToken, Token} from 'marked'

export interface MarkdownProps {
  text: string
}

const MAX_HEADING_DEPTH = 4
const HR_WIDTH = 40

function headingLevel(depth: number): 'h1' | 'h2' | 'h3' | 'h4' {
  const clamped = Math.min(Math.max(depth, 1), MAX_HEADING_DEPTH)
  return `h${clamped}` as 'h1' | 'h2' | 'h3' | 'h4'
}

/** Inline tokens (bold/italic/strikethrough/inline-code/links) rendered inside a single Text run. */
function renderInline(tokens: Token[], keyPrefix: string): ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}:${index}`
    const marked_ = token as MarkedToken

    // Rarely-used inline token types (table/image/html/def/checkbox/list_item) fall through to the
    // default case below, which renders their raw markdown source as plain text.
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (marked_.type) {
      case 'strong':
        return (
          <Text key={key} bold>
            {renderInline(marked_.tokens, key)}
          </Text>
        )
      case 'em':
        return (
          <Text key={key} italic>
            {renderInline(marked_.tokens, key)}
          </Text>
        )
      case 'del':
        return (
          <Text key={key} strikethrough>
            {renderInline(marked_.tokens, key)}
          </Text>
        )
      case 'codespan':
        return (
          <Text key={key} color="magentaBright">
            {marked_.text}
          </Text>
        )
      case 'link': {
        const label = marked_.text || marked_.href
        const suffix = label === marked_.href ? '' : ` (${marked_.href})`
        return (
          <Text key={key} underline>
            {label}
            {suffix}
          </Text>
        )
      }
      case 'escape':
      case 'text':
        return <Text key={key}>{marked_.text}</Text>
      case 'br':
        return <Text key={key}>{'\n'}</Text>
      default:
        return <Text key={key}>{marked_.raw}</Text>
    }
  })
}

function renderBlock(token: Token, key: string): ReactNode {
  const marked_ = token as MarkedToken

  // Inline and rarely-used block token types (table/image/html/def/checkbox/text/br) fall through
  // to the default case below, which renders their raw markdown source as plain text.
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
  switch (marked_.type) {
    case 'heading':
      return renderHeadingText(renderInline(marked_.tokens, key), headingLevel(marked_.depth), undefined, key)
    case 'paragraph':
      return <Text key={key}>{renderInline(marked_.tokens, key)}</Text>
    case 'code':
      return (
        <Box key={key} flexDirection="column" marginLeft={2} borderStyle="single" borderColor="gray">
          {marked_.text.split('\n').map((line, index) => (
            <Text key={index} dimColor>
              {line}
            </Text>
          ))}
        </Box>
      )
    case 'blockquote':
      return (
        <LeftBarBox key={key}>{marked_.tokens.map((child, index) => renderBlock(child, `${key}:${index}`))}</LeftBarBox>
      )
    case 'list':
      return (
        <Box key={key} flexDirection="column">
          {marked_.items.map((item, index) =>
            renderListRow(
              marked_.ordered ? `${(marked_.start || 1) + index}.` : '•',
              renderInline(item.tokens, `${key}:${index}`),
              index,
            ),
          )}
        </Box>
      )
    case 'hr':
      return <Text key={key}>{'─'.repeat(HR_WIDTH)}</Text>
    case 'space':
      return null
    default:
      return <Text key={key}>{marked_.raw}</Text>
  }
}

export function MarkdownRenderer({element}: ComponentRenderProps<MarkdownProps>) {
  const tokens = marked.lexer(element.props.text)

  return <Box flexDirection="column">{tokens.map((token, index) => renderBlock(token, `${index}`))}</Box>
}
