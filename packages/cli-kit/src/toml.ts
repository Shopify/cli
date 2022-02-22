import * as toml from 'toml'

export function parse(input: string): object {
  return toml.parse(input)
}
