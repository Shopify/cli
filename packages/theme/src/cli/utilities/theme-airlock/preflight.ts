import {renderInfo} from '@shopify/cli-kit/node/ui'

import type {AirlockTarget} from './types.js'

export function airlockEnvironmentLabel(target: AirlockTarget): string {
  if (target.source === 'default') return 'default (implicit)'
  if (target.source === 'sole-store') return 'sole project store (implicit)'

  const environment = target.environment ?? 'unknown environment'
  if (target.source === 'explicit-environment') return environment

  return target.implicit ? `${environment} (implicit)` : environment
}

function selectedByLabel(target: AirlockTarget): string {
  switch (target.source) {
    case 'explicit-store':
      return '--store'
    case 'environment-variable':
      return 'SHOPIFY_FLAG_STORE'
    case 'bootstrap':
      return 'bootstrap setup'
    case 'default':
    case 'sole-store':
    case 'explicit-environment':
      return 'shopify.theme.toml'
  }
}

export function renderAirlockPreflight(command: string, targets: AirlockTarget[]): void {
  if (targets.length === 1) {
    const [target] = targets
    if (!target) return

    renderInfo({
      // The exact headline is part of the Airlock output contract.
      // eslint-disable-next-line @shopify/cli/banner-headline-format
      headline: 'Theme Airlock',
      customSections: [
        {
          title: 'Target',
          body: {
            tabularData: [
              ['Environment', airlockEnvironmentLabel(target)],
              ['Store', target.store],
              ['Selected by', selectedByLabel(target)],
              ['Operation', `theme ${command}`],
            ],
            firstColumnSubdued: true,
          },
        },
      ],
    })
    return
  }

  renderInfo({
    // The exact headline is part of the Airlock output contract.
    // eslint-disable-next-line @shopify/cli/banner-headline-format
    headline: 'Theme Airlock',
    body: 'The following explicitly selected stores will be used.',
    customSections: [
      {
        title: 'explicitly selected stores',
        body: {
          tabularData: [
            ['Environment', 'Store', 'Selected by', 'Status', 'Operation'],
            ...targets.map((target) => [
              target.environment ?? 'unknown environment',
              target.store,
              selectedByLabel(target),
              target.implicit ? 'implicit' : 'explicit',
              `theme ${command}`,
            ]),
          ],
          firstColumnSubdued: true,
        },
      },
    ],
  })
}
