import Haikunator from 'haikunator'

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

const haikunator = new Haikunator({
  adjectives: SAFE_ADJECTIVES,
  nouns: SAFE_NOUNS,
  defaults: {
    tokenLength: 0,
  },
})

export function generate(suffix: string): string {
  const generated = haikunator.haikunate()
  return [generated, suffix].join('-')
}
