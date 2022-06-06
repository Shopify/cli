import Haikunator from 'haikunator'

const haikunator = new Haikunator()

export function generate(suffix: string): string {
  const generated = haikunator.haikunate()
  const [adjective, noun, token] = generated.split('-')
  return [adjective, noun, suffix, token].join('-')
}
