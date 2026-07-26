import {
  buildCommandCatalog,
  commandChoiceLabel,
  commandChoices,
  groupForEntry,
  matchesSearchTerm,
  searchCatalog,
  topicOrder,
} from './catalog.js'
import {Command} from '@oclif/core'
import {describe, expect, test} from 'vitest'

function loadable(command: {id: string; summary?: string; description?: string; hidden?: boolean}): Command.Loadable {
  return {hidden: false, ...command} as unknown as Command.Loadable
}

describe('buildCommandCatalog', () => {
  test('maps commands to entries with a one-line description and top-level topic', () => {
    // Given
    const commands = [loadable({id: 'app:dev', summary: 'Run the app locally'})]

    // When
    const catalog = buildCommandCatalog(commands)

    // Then
    expect(catalog).toEqual([{id: 'app:dev', description: 'Run the app locally', topic: 'app'}])
  })

  test('prefers summary but falls back to the first line of the description', () => {
    // Given
    const commands = [loadable({id: 'theme:dev', description: 'Serve the theme.\nMore details here.'})]

    // When
    const catalog = buildCommandCatalog(commands)

    // Then
    expect(catalog[0]?.description).toBe('Serve the theme.')
  })

  test('skips hidden commands and the wizard itself, and sorts by id', () => {
    // Given
    const commands = [
      loadable({id: 'wizard', summary: 'The wizard'}),
      loadable({id: 'theme:dev', summary: 'Theme'}),
      loadable({id: 'app:dev', summary: 'App'}),
      loadable({id: 'secret', summary: 'Hidden', hidden: true}),
    ]

    // When
    const catalog = buildCommandCatalog(commands)

    // Then
    expect(catalog.map((entry) => entry.id)).toEqual(['app:dev', 'theme:dev'])
  })
})

describe('matchesSearchTerm', () => {
  const entry = {id: 'app:generate:extension', description: 'Scaffold a new extension', topic: 'app'}

  test('matches against the id', () => {
    expect(matchesSearchTerm(entry, 'APP:G')).toBe(true)
  })

  test('matches against the description', () => {
    expect(matchesSearchTerm(entry, 'scaffold')).toBe(true)
  })

  test('matches a space-separated term against a colon-separated id', () => {
    // The list shows `app generate extension`, so typing what you see has to work.
    expect(matchesSearchTerm(entry, 'app generate')).toBe(true)
  })

  test('matches a colon-separated term against the same id', () => {
    // And so does typing the canonical id.
    expect(matchesSearchTerm(entry, 'app:generate')).toBe(true)
  })

  test('treats runs of colons and whitespace as a single separator', () => {
    expect(matchesSearchTerm(entry, '  app:  generate ')).toBe(true)
  })

  test('an empty term matches everything', () => {
    expect(matchesSearchTerm(entry, '   ')).toBe(true)
  })

  test('returns false when neither id nor description contains the term', () => {
    expect(matchesSearchTerm(entry, 'theme')).toBe(false)
  })
})

describe('searchCatalog', () => {
  test('filters to matching entries', () => {
    // Given
    const catalog = buildCommandCatalog([
      loadable({id: 'app:dev', summary: 'Run the app'}),
      loadable({id: 'theme:dev', summary: 'Run the theme'}),
    ])

    // When
    const results = searchCatalog(catalog, 'theme')

    // Then
    expect(results.map((entry) => entry.id)).toEqual(['theme:dev'])
  })

  test('filters separator-agnostically', () => {
    // Given
    const catalog = buildCommandCatalog([
      loadable({id: 'app:generate:extension', summary: 'Scaffold'}),
      loadable({id: 'theme:dev', summary: 'Run the theme'}),
    ])

    // When
    const results = searchCatalog(catalog, 'app generate')

    // Then
    expect(results.map((entry) => entry.id)).toEqual(['app:generate:extension'])
  })
})

describe('commandChoices', () => {
  const catalog = buildCommandCatalog([
    loadable({id: 'app:dev', summary: 'Run the app'}),
    loadable({id: 'theme:dev', summary: 'Run the theme'}),
  ])

  test('returns only the matching commands, with no extra affordance', () => {
    // When
    const choices = commandChoices(catalog, 'theme')

    // Then
    expect(choices.map((choice) => choice.value)).toEqual(['theme:dev'])
  })

  test('returns nothing when no command matches', () => {
    expect(commandChoices(catalog, 'no-such-command')).toEqual([])
  })

  test('shows a spaced label while keeping the real colon id as the value', () => {
    // Given: a deeply namespaced command.
    const nestedCatalog = buildCommandCatalog([loadable({id: 'app:generate:extension', summary: 'Scaffold'})])

    // When
    const choices = commandChoices(nestedCatalog, '')

    // Then: the label is display-only; the value is the id the wizard hands off.
    expect(choices).toEqual([
      {
        label: 'app generate extension',
        value: 'app:generate:extension',
        description: 'Scaffold',
        group: 'app',
      },
    ])
  })

  test('carries the description in a separate field and groups by topic', () => {
    // When
    const choices = commandChoices(catalog, 'theme')

    // Then: the description is carried separately so cli-kit renders it in the
    // panel — never baked into the label where it would wrap.
    expect(choices[0]).toEqual({
      label: 'theme dev',
      value: 'theme:dev',
      description: 'Run the theme',
      group: 'theme',
    })
  })

  test('leaves a standalone top-level command ungrouped so it lands in "Other"', () => {
    // Given
    const mixedCatalog = buildCommandCatalog([
      loadable({id: 'app:dev', summary: 'Run the app'}),
      loadable({id: 'upgrade', summary: 'Upgrade the CLI'}),
    ])

    // When
    const choices = commandChoices(mixedCatalog, 'upgrade')

    // Then: cli-kit renders an undefined group under its automatic "Other" title.
    expect(choices).toEqual([{label: 'upgrade', value: 'upgrade', description: 'Upgrade the CLI', group: undefined}])
  })

  test('finds a command whose search term appears only in its description', () => {
    // Given: a catalog where the term "storefront" is in the description, not the id.
    const conceptCatalog = buildCommandCatalog([
      loadable({id: 'theme:dev', summary: 'Preview your storefront locally'}),
    ])

    // When
    const choices = commandChoices(conceptCatalog, 'storefront')

    // Then: concept search still works even though the description is no longer in
    // the label — the row stays id-only.
    expect(choices[0]).toEqual({
      label: 'theme dev',
      value: 'theme:dev',
      description: 'Preview your storefront locally',
      group: 'theme',
    })
  })

  test('omits an empty description rather than passing an empty panel string', () => {
    // Given
    const bareCatalog = buildCommandCatalog([loadable({id: 'app:dev'})])

    // When
    const choices = commandChoices(bareCatalog, '')

    // Then
    expect(choices[0]?.description).toBeUndefined()
  })
})

describe('commandChoiceLabel', () => {
  test('renders colons as spaces', () => {
    expect(commandChoiceLabel({id: 'app:generate:extension', description: 'Scaffold', topic: 'app'})).toBe(
      'app generate extension',
    )
  })

  test('leaves a top-level command id untouched', () => {
    expect(commandChoiceLabel({id: 'upgrade', description: '', topic: 'upgrade'})).toBe('upgrade')
  })
})

describe('groupForEntry', () => {
  const catalog = buildCommandCatalog([
    loadable({id: 'app:dev', summary: 'App dev'}),
    loadable({id: 'theme', summary: 'Theme root'}),
    loadable({id: 'theme:dev', summary: 'Theme dev'}),
    loadable({id: 'upgrade', summary: 'Upgrade'}),
  ])

  function entryFor(id: string) {
    const entry = catalog.find((candidate) => candidate.id === id)
    if (!entry) throw new Error(`No catalog entry for "${id}"`)
    return entry
  }

  test('groups a namespaced command under its top-level segment', () => {
    expect(groupForEntry(entryFor('app:dev'), catalog)).toBe('app')
  })

  test('groups a top-level command that has nested commands under its own name', () => {
    expect(groupForEntry(entryFor('theme'), catalog)).toBe('theme')
  })

  test('leaves a standalone top-level command ungrouped', () => {
    expect(groupForEntry(entryFor('upgrade'), catalog)).toBeUndefined()
  })
})

describe('topicOrder', () => {
  test('lists the defined groups sorted, de-duplicated, and without the ungrouped ones', () => {
    // Given: two `theme` commands (a duplicate group), an `app` one, and two
    // standalone commands that belong in cli-kit's automatic "Other".
    const catalog = buildCommandCatalog([
      loadable({id: 'theme:dev', summary: 'Theme dev'}),
      loadable({id: 'theme:push', summary: 'Theme push'}),
      loadable({id: 'app:dev', summary: 'App dev'}),
      loadable({id: 'upgrade', summary: 'Upgrade'}),
      loadable({id: 'version', summary: 'Version'}),
    ])

    // When
    const order = topicOrder(catalog)

    // Then: "Other" is not listed — cli-kit appends it last on its own.
    expect(order).toEqual(['app', 'theme'])
  })

  test('is empty for a catalog of standalone commands only', () => {
    const catalog = buildCommandCatalog([loadable({id: 'upgrade', summary: 'Upgrade'})])
    expect(topicOrder(catalog)).toEqual([])
  })
})
