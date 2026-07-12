import {Marked, type MarkedExtension} from 'marked'
import {markedTerminal} from 'marked-terminal'

// `@types/marked-terminal` still types `markedTerminal()` against the package's older
// API (a `Renderer` subclass), but marked-terminal 7.x actually returns a plain
// `MarkedExtension` object at runtime, which is what `Marked#use` expects.
const terminalRendererExtension = markedTerminal() as unknown as MarkedExtension

// A dedicated Marked instance, rather than the shared default one, configured to render
// Markdown as ANSI-styled text for terminal output.
const terminalMarked = new Marked().use(terminalRendererExtension)

/**
 * Renders Markdown as ANSI-styled text suitable for printing to a terminal.
 *
 * @param markdown - The Markdown source to render.
 * @returns The rendered, ANSI-styled text.
 */
export function renderMarkdown(markdown: string): string {
  // `markedTerminal` renders synchronously, so `.parse` never actually returns a
  // Promise here — the union return type just reflects that some other extension could.
  return terminalMarked.parse(markdown) as string
}
