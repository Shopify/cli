// Re-export strip-ansi as a named export for easier use.
// strip-ansi v7+ is ESM-only and exports a default function.
import stripAnsiModule from 'strip-ansi'

export const stripAnsi: (text: string) => string = stripAnsiModule
