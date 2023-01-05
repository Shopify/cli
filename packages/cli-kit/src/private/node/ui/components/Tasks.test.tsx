import Tasks from './Tasks.js'
import {getLastFrameAfterUnmount} from '../../../../testing/ui.js'
import React from 'react'
import {describe, expect, test} from 'vitest'
import {render} from 'ink-testing-library'

describe('Tasks', () => {
  test('shows a success state at the end', async () => {
    // Given
    const firstTask = {
      title: 'task 1',
      task: async () => {},
    }

    const secondTask = {
      title: 'task 2',
      task: async () => {},
    }
    // When

    const renderInstance = render(<Tasks tasks={[firstTask, secondTask]} />)

    // wait for next tick
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Then
    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "[32m████████████████████████████████████████████████████████████████████████████████[39m
      Complete!"
    `)
  })

  test('shows a failure state at the end', async () => {
    // Given
    const firstTask = {
      title: 'task 1',
      task: async () => {
        throw new Error('something went wrong')
      },
    }

    const secondTask = {
      title: 'task 2',
      task: async () => {},
    }

    // When
    const renderInstance = render(<Tasks tasks={[firstTask, secondTask]} />)

    // wait for next tick
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Then
    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "[31m████████████████████████████████████████████████████████████████████████████████[39m
      task 1"
    `)
  })
})
