import * as yaml from 'js-yaml'

export function decode(input: string): unknown {
  return yaml.load(input)
}

export function encode(content: unknown): string {
  return yaml.dump(content)
}
