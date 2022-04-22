import * as yaml from 'js-yaml'

export function decode(input: string): any {
  return yaml.load(input)
}

export function encode(content: any): string {
  return yaml.dump(content)
}
