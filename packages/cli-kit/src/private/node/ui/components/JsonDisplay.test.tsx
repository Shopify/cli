import {JsonDisplay} from './JsonDisplay.js'
import {render} from '../../testing/ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('JsonDisplay', async () => {
  test('renders simple object correctly', async () => {
    const data = {name: 'test', value: 42}
    const {lastFrame} = render(<JsonDisplay data={data} />)

    expect(lastFrame()).toContain('test')
    expect(lastFrame()).toContain('42')
  })

  test('renders array correctly', async () => {
    const data = ['item1', 'item2', 'item3']
    const {lastFrame} = render(<JsonDisplay data={data} />)

    expect(lastFrame()).toContain('item1')
    expect(lastFrame()).toContain('item2')
    expect(lastFrame()).toContain('item3')
  })

  test('handles null and undefined gracefully', async () => {
    const {lastFrame} = render(<JsonDisplay data={null} />)
    expect(lastFrame()).toContain('null')
  })
})
