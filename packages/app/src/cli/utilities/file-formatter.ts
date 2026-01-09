import prettier from 'prettier'
import type {Options} from 'prettier'

/**
 * Formats the contents of a file being generated.
 * @param content - The content to format.
 * @param options - The options to pass to the formatter.
 * @returns The formatted content.
 */
export async function formatContent(content: string, options?: Options): Promise<string> {
  return prettier.format(content, options)
}
