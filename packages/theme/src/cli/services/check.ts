import {Offense} from '@shopify/theme-check-common'

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

type InlineToken = Exclude<Token, ListToken>
interface ListToken {
  list: {
    title?: TokenItem<InlineToken>
    items: TokenItem<InlineToken>[]
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

type TokenItem<T extends Token = Token> = T | T[]

interface CustomSection {
  title?: string
  body: TokenItem
}

// TODO: CONSIDER EXPOSING THOSE TYPES PUBLICALLY FROM UI-KIT

interface OffensesByCheck {
  [check: string]: Offense[]
}

/**
 * Format theme-check Offenses into a format for cli-kit to output.
 */
export function formatOffenses(offenses: Offense[]): CustomSection[] {
  const offensesByCheck = offenses.reduce((obj: OffensesByCheck, offense: Offense) => {
    if (!obj[offense.check]) {
      obj[offense.check] = []
    }

    obj[offense.check]!.push(offense)

    return obj
  }, {})

  return Object.keys(offensesByCheck).map((check) => {
    const checkOffenses = offensesByCheck[check]

    const items = checkOffenses!.map((offense) => {
      const {message, absolutePath, start} = offense
      return [{bold: `${absolutePath}:${start.line}`}, message]
    })

    return {
      title: check,
      body: {list: {items}},
    }
  })
}
