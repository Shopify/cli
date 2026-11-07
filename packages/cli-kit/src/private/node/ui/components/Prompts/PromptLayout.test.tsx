import {PromptLayout} from './PromptLayout.js'
import {PromptState} from '../../hooks/use-prompt.js'
import {render} from '../../../testing/ui.js'
import {Stdout} from '../../../ui.js'
import {SelectInput} from '../SelectInput.js'
import {describe, expect, test, vi} from 'vitest'
import React from 'react'
import {Box, Text} from 'ink'

describe('PromptLayout', async () => {
  test('renders choices when the output stream has no terminal row count', async () => {
    const stdout = new Stdout({columns: 80})
    Reflect.deleteProperty(stdout, 'rows')
    const renderInstance = render(
      <PromptLayout
        message="Which option?"
        state={PromptState.Idle}
        input={
          <SelectInput
            items={[
              {label: 'First option', value: 'first'},
              {label: 'Second option', value: 'second'},
            ]}
            onSubmit={() => {}}
          />
        }
      />,
      {stdout},
    )

    try {
      await vi.waitFor(() => expect(stdout.lastFrame()).toContain('Second option'))
      stdout.emit('resize')
      await vi.waitFor(() => expect(stdout.lastFrame()).toContain('First option'))
    } finally {
      renderInstance.unmount()
      renderInstance.cleanup()
    }
  })

  test("doesn't add unnecessary margins when infoTable is an empty array", async () => {
    const items = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
      {label: 'fourth', value: 'fourth'},
    ]

    const renderInstance = render(
      <PromptLayout
        message="Associate your project with the org Castile Ventures?"
        infoTable={[]}
        state={PromptState.Idle}
        input={
          <Box flexDirection="column">
            {items.map((item) => (
              <Text key={item.value}>{item.label}</Text>
            ))}
          </Box>
        }
      />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?

      first
      second
      third
      fourth
      "
    `)
  })

  test("doesn't add unnecessary margins when infoTable is an empty object", async () => {
    const items = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
      {label: 'fourth', value: 'fourth'},
    ]

    const renderInstance = render(
      <PromptLayout
        message="Associate your project with the org Castile Ventures?"
        infoTable={{}}
        state={PromptState.Idle}
        input={
          <Box flexDirection="column">
            {items.map((item) => (
              <Text key={item.value}>{item.label}</Text>
            ))}
          </Box>
        }
      />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?

      first
      second
      third
      fourth
      "
    `)
  })

  test("doesn't add unnecessary margins when infoTable is empty and there are other elements in the header", async () => {
    const items = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
      {label: 'fourth', value: 'fourth'},
    ]

    const infoMessage = {
      title: {text: 'some title'},
      body: 'some body',
    }

    const renderInstance = render(
      <PromptLayout
        message="Associate your project with the org Castile Ventures?"
        infoTable={[]}
        infoMessage={infoMessage}
        state={PromptState.Idle}
        input={
          <Box flexDirection="column">
            {items.map((item) => (
              <Text key={item.value}>{item.label}</Text>
            ))}
          </Box>
        }
      />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?

         ┃  some title
         ┃
         ┃  some body

      first
      second
      third
      fourth
      "
    `)
  })

  test('can have all elements visible in the header at the same time', async () => {
    const items = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
      {label: 'fourth', value: 'fourth'},
    ]

    const infoMessage = {
      title: {text: 'some title'},
      body: 'some body',
    }

    const infoTable = {
      header1: ['item 1', 'item 2', 'item 3'],
      header2: ['item 4', 'item 5', 'item 6'],
      header3: ['item 7', 'item 8', 'item 9'],
    }

    const renderInstance = render(
      <PromptLayout
        message="Associate your project with the org Castile Ventures?"
        infoTable={infoTable}
        infoMessage={infoMessage}
        state={PromptState.Idle}
        input={
          <Box flexDirection="column">
            {items.map((item) => (
              <Text key={item.value}>{item.label}</Text>
            ))}
          </Box>
        }
      />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?

         ┃  some title
         ┃
         ┃  some body
         ┃
         ┃  [1mHeader1[22m
         ┃  • item 1
         ┃  • item 2
         ┃  • item 3
         ┃
         ┃  [1mHeader2[22m
         ┃  • item 4
         ┃  • item 5
         ┃  • item 6
         ┃
         ┃  [1mHeader3[22m
         ┃  • item 7
         ┃  • item 8
         ┃  • item 9

      first
      second
      third
      fourth
      "
    `)
  })
})
