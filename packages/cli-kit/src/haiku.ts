import Haikunator from 'haikunator'

const haikunator = new Haikunator({
  adjectives: [
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
  ],
  nouns: [
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
  ],
  defaults: {
    tokenLength: 0,
  },
})

export function generate(suffix: string): string {
  const generated = haikunator.haikunate()
  return [generated, suffix].join('-')
}
