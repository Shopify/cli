import {file, path} from './index'

export const SAFE_ADJECTIVES = [
  'commercial',
  'profitable',
  'amortizable',
  'branded',
  'integrated',
  'synergistic',
  'consolidated',
  'diversified',
  'lean',
  'niche',
  'premium',
  'luxury',
  'scalable',
  'optimized',
  'empowered',
  'international',
  'beneficial',
  'fruitful',
  'extensive',
  'lucrative',
  'modern',
]

export const SAFE_NOUNS = [
  'account',
  'consumer',
  'customer',
  'enterprise',
  'business',
  'venture',
  'marketplace',
  'revenue',
  'vertical',
  'portfolio',
  'negotiation',
  'shipping',
  'demand',
  'supply',
  'growth',
  'merchant',
  'investment',
  'shareholder',
  'conversion',
  'capital',
  'projection',
  'upside',
  'trade',
  'deal',
  'merchandise',
  'transaction',
  'sale',
]

export async function generate({
  suffix,
  directory,
  randomPick = (array: string[]) => array[Math.floor(Math.random() * array.length)],
}: {
  suffix: string
  directory: string
  randomPick: (array: string[]) => string
}): Promise<string> {
  const adjective = randomPick(SAFE_ADJECTIVES)
  const noun = randomPick(SAFE_NOUNS)
  const generated = [adjective, noun, suffix].join('-')
  const isAppDirectoryTaken = await file.exists(path.join(directory, generated))

  if (isAppDirectoryTaken) {
    // eslint-disable-next-line no-return-await
    return await generate({suffix, directory, randomPick})
  } else {
    return generated
  }
}
