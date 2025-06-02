import {ColoredText} from './components/ColoredText.js'
import {Icon} from './components/Icon.js'
import {TokenizedText, TokenItem} from './components/TokenizedText.js'
import React from 'react'

/**
 * Migration utilities to help convert outputContent + outputToken patterns
 * to the new ink.js React component system.
 */

/**
 * Helper to create a colored text token for use in TokenizedText
 */
export function createColorToken(
  text: string,
  color: 'green' | 'yellow' | 'cyan' | 'magenta' | 'gray' | 'blue' | 'red',
) {
  return {
    color: {
      text,
      color,
    },
  }
}

/**
 * Helper to create a JSON token for use in TokenizedText
 */
export function createJsonToken(data: unknown) {
  return {
    json: data,
  }
}

/**
 * Helper to create an icon token for use in TokenizedText
 */
export function createIconToken(type: 'success' | 'fail' | 'warning' | 'info') {
  return {
    icon: type,
  }
}

/**
 * Helper to create a debug token for use in TokenizedText
 */
export function createDebugToken(message: string) {
  return {
    debug: message,
  }
}

/**
 * Quick migration wrapper for simple outputContent patterns.
 * Converts an array of mixed content to a TokenizedText component.
 *
 * @example
 * ```
 * // Old:
 * outputContent`$\{outputToken.green('SUCCESS')\} App deployed to $\{outputToken.path('/apps/my-app')\}`
 *
 * // New:
 * \<MigratedText content=\{[
 *   createColorToken('SUCCESS', 'green'),
 *   ' App deployed to ',
 *   \{filePath: '/apps/my-app'\}
 * ]\} /\>
 * ```
 */
export const MigratedText: React.FC<{content: TokenItem}> = ({content}) => {
  return <TokenizedText item={content} />
}

/**
 * Direct component alternatives for standalone usage
 */

// Direct color component alternatives
export const GreenText: React.FC<{children: string}> = ({children}) => <ColoredText text={children} color="green" />

export const YellowText: React.FC<{children: string}> = ({children}) => <ColoredText text={children} color="yellow" />

export const CyanText: React.FC<{children: string}> = ({children}) => <ColoredText text={children} color="cyan" />

export const MagentaText: React.FC<{children: string}> = ({children}) => <ColoredText text={children} color="magenta" />

export const GrayText: React.FC<{children: string}> = ({children}) => <ColoredText text={children} color="gray" />

// Icon shortcuts
export const SuccessIcon: React.FC = () => <Icon type="success" />
export const FailIcon: React.FC = () => <Icon type="fail" />

/**
 * Migration examples and common patterns
 */
export const migrationExamples = {
  // outputToken.green('SUCCESS') -> createColorToken('SUCCESS', 'green')
  coloredText: createColorToken('SUCCESS', 'green'),

  // outputToken.path('/path/to/file') -> {filePath: '/path/to/file'}
  filePath: {filePath: '/path/to/file'},

  // outputToken.genericShellCommand('npm install') -> {command: 'npm install'}
  command: {command: 'npm install'},

  // outputToken.json(data) -> createJsonToken(data)
  json: createJsonToken({key: 'value'}),

  // outputToken.successIcon() -> createIconToken('success')
  successIcon: createIconToken('success'),

  // outputToken.failIcon() -> createIconToken('fail')
  failIcon: createIconToken('fail'),

  // Debug messages -> createDebugToken('message')
  debug: createDebugToken('debug information'),
}
