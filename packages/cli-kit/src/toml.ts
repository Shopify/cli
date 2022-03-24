import * as toml from '@iarna/toml'

export function parse(input: string): object {
  return toml.parse(input)
}

export function stringify(content: any): string {
  return toml.stringify(content)
}
