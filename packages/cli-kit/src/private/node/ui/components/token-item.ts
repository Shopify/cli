// Token shapes and the pure helpers that operate on them.
//
// These live apart from `TokenizedText.tsx` on purpose. That file is a React
// component module: importing it pulls in `react` and `ink`, and through Ink,
// `react-reconciler`, `yoga-layout` and its WebAssembly. Non-rendering modules
// such as `output.ts`, `error.ts` and `common/string.ts` need only the types
// and `tokenItemToString`, and importing them from here keeps the terminal UI
// runtime out of the startup path of every command.

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
