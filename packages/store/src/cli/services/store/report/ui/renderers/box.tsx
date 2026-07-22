import {safeBoxProps} from './safe-props.js'
import {Box, Text} from 'ink'
import React from 'react'
import type {ComponentRenderProps} from '@json-render/ink'
import type {BoxProps as InkBoxProps, TextProps as InkTextProps} from 'ink'

export type BoxRendererProps = Partial<InkBoxProps>

export function BoxRenderer({element, children}: ComponentRenderProps<BoxRendererProps>) {
  return <Box {...safeBoxProps(element.props)}>{children}</Box>
}

export interface TextRendererProps extends Partial<InkTextProps> {
  text: string
}

export function TextRenderer({element}: ComponentRenderProps<TextRendererProps>) {
  const {text, ...style} = element.props
  return <Text {...safeBoxProps(style)}>{text ?? ''}</Text>
}
