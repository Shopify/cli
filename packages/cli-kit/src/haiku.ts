import {randomPick} from './array.js'
import {exists} from './file.js'
import {join} from './path.js'

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

function generateRandomName() {
  return `${randomPick(SAFE_ADJECTIVES)}-${randomPick(SAFE_NOUNS)}`
}

export async function generate({suffix, directory}: {suffix: string; directory: string}): Promise<string> {
  const generated = `${generateRandomName()}-${suffix}`
  const isAppDirectoryTaken = await exists(join(directory, generated))

  if (isAppDirectoryTaken) {
    return generate({suffix, directory})
  } else {
    return generated
  }
}
