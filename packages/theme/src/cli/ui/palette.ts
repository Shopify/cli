import colors from '@shopify/cli-kit/node/colors'

export const palette = {
  // neutral gray chrome — box borders + the "development" role label (recedes).
  // Named ANSI so it adapts to the terminal theme instead of a fixed hex.
  border: 'gray',
  // box titles and table column headers: terminal default foreground (undefined)
  // so headings stay high-contrast on both light and dark terminals. Consumers
  // keep `bold` for emphasis.
  header: undefined,
  // named-ANSI red accent — the soft/destructive/attention accent
  accent: 'red',
  // named-ANSI green — the semantic "good/safe/live/success" accent
  role: 'green',
  // body text: terminal default foreground (undefined) so it adapts to the theme
  text: undefined,
  // recedes — named-ANSI gray for secondary/subdued text
  subdued: 'gray',
  methods: {
    // reuse role green — safe/read verb
    get: 'green',
    // blue — create/write verb
    post: 'blue',
    // yellow — update verb (PUT/PATCH share)
    put: 'yellow',
    // red — destructive verb
    delete: 'red',
    // gray — HEAD/OPTIONS/unknown
    other: 'gray',
  },
  status: {
    // 2xx — reuse role green
    success: 'green',
    // 3xx — yellow
    redirect: 'yellow',
    // 4xx/5xx — red
    error: 'red',
  },
} as const

// Only the flat string tokens are addressable as a PaletteColor; the nested
// methods/status groups are referenced directly (e.g. palette.methods.get) and
// intentionally excluded so single-string consumers keep a string union. Now a
// union of the named-ANSI literals plus `undefined` (default foreground).
export type PaletteColor =
  | typeof palette.border
  | typeof palette.header
  | typeof palette.accent
  | typeof palette.role
  | typeof palette.text
  | typeof palette.subdued

// Chalk stylers keyed by the named-ANSI values the palette uses. Calling chalk
// with no style (`colors`) is an identity styler, so an unknown/undefined name
// renders in the terminal's default foreground while still supporting chaining
// like `.bold`.
const chalkByName: Record<string, typeof colors> = {
  gray: colors.gray,
  green: colors.green,
  red: colors.red,
  blue: colors.blue,
  yellow: colors.yellow,
}

export function paint(name: string | undefined): typeof colors {
  if (!name) return colors
  return chalkByName[name] ?? colors
}
