import {
  BROWSE_BY_TOPIC,
  browsableTopics,
  buildCommandCatalog,
  commandChoiceLabel,
  commandChoices,
  commandsInTopic,
  matchesSearchTerm,
  searchCatalog,
} from './catalog.js'
import {Command, Interfaces} from '@oclif/core'
import {describe, expect, test} from 'vitest'

function loadable(command: {id: string; summary?: string; description?: string; hidden?: boolean}): Command.Loadable {
  return {hidden: false, ...command} as unknown as Command.Loadable
}

function topic(name: string, options: {description?: string; hidden?: boolean} = {}): Interfaces.Topic {
  return {name, ...options}
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
  const entry = {id: 'app:dev', description: 'Run the app locally', topic: 'app'}

  test('matches against the id', () => {
    expect(matchesSearchTerm(entry, 'APP:D')).toBe(true)
  })

  test('matches against the description', () => {
    expect(matchesSearchTerm(entry, 'locally')).toBe(true)
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
})

describe('commandChoices', () => {
  const catalog = buildCommandCatalog([
    loadable({id: 'app:dev', summary: 'Run the app'}),
    loadable({id: 'theme:dev', summary: 'Run the theme'}),
  ])

  test('lists matching commands first and appends the browse affordance last', () => {
    // When
    const choices = commandChoices(catalog, 'theme')

    // Then: a real command is the first (default-highlighted) choice, and the
    // browse sentinel is appended at the very end — never pinned to the top, where
    // cli-kit's highlight reset would make an exact-match Enter select "browse".
    expect(choices[0]?.value).toBe('theme:dev')
    expect(choices[choices.length - 1]?.value).toBe(BROWSE_BY_TOPIC)
    expect(choices.map((choice) => choice.value)).toEqual(['theme:dev', BROWSE_BY_TOPIC])
  })

  test('carries an id-only label and the description in a separate field', () => {
    // When
    const choices = commandChoices(catalog, 'theme')

    // Then: the label is the id alone (single-line rows), and the description is
    // carried separately so cli-kit renders it in the panel — never baked into the
    // label where it would wrap.
    expect(choices[0]).toEqual({label: 'theme:dev', value: 'theme:dev', description: 'Run the theme'})
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
      label: 'theme:dev',
      value: 'theme:dev',
      description: 'Preview your storefront locally',
    })
    // And the underlying matcher confirms it matched on description, not id.
    expect(searchCatalog(conceptCatalog, 'storefront').map((entry) => entry.id)).toEqual(['theme:dev'])
  })

  test('offers only the browse affordance when nothing matches', () => {
    const choices = commandChoices(catalog, 'no-such-command')
    expect(choices.map((choice) => choice.value)).toEqual([BROWSE_BY_TOPIC])
  })

  test('gives the browse affordance a descriptive panel entry', () => {
    const choices = commandChoices(catalog, 'theme')
    const browse = choices[choices.length - 1]
    expect(browse).toEqual({
      label: 'Browse commands by topic instead…',
      value: BROWSE_BY_TOPIC,
      description: 'Pick a topic, then a command within it.',
    })
  })
})

describe('commandChoiceLabel', () => {
  test('returns the id alone, regardless of description', () => {
    expect(commandChoiceLabel({id: 'app:dev', description: 'Run the app', topic: 'app'})).toBe('app:dev')
    expect(commandChoiceLabel({id: 'app:dev', description: '', topic: 'app'})).toBe('app:dev')
  })
})

describe('commandsInTopic', () => {
  test('includes the topic command itself and its nested commands', () => {
    // Given
    const catalog = buildCommandCatalog([
      loadable({id: 'theme', summary: 'Theme root'}),
      loadable({id: 'theme:dev', summary: 'Theme dev'}),
      loadable({id: 'app:dev', summary: 'App dev'}),
    ])

    // When
    const results = commandsInTopic(catalog, 'theme')

    // Then
    expect(results.map((entry) => entry.id)).toEqual(['theme', 'theme:dev'])
  })
})

describe('browsableTopics', () => {
  test('keeps non-hidden topics that contain at least one command, sorted by name', () => {
    // Given
    const catalog = buildCommandCatalog([
      loadable({id: 'app:dev', summary: 'App dev'}),
      loadable({id: 'theme:dev', summary: 'Theme dev'}),
    ])
    const topics = [
      topic('theme', {description: 'Theme tools'}),
      topic('app'),
      topic('empty', {description: 'Nothing here'}),
      topic('hidden-topic', {hidden: true}),
    ]

    // When
    const browsable = browsableTopics(topics, catalog)

    // Then
    expect(browsable).toEqual([
      {name: 'app', description: ''},
      {name: 'theme', description: 'Theme tools'},
    ])
  })
})
