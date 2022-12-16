import Tasks from './Tasks.js'
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

    const {lastFrame} = render(<Tasks tasks={[firstTask, secondTask]} />)

    // sleep 200ms to wait for all tasks to finish
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Then
    expect(lastFrame()).toMatchInlineSnapshot(`
      "[32m████████████████████████████████████████████████████████████████████████████████[39m

      Complete!
      "
    `)
  })

  test('shows a success state at the end', async () => {
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
    const {lastFrame} = render(<Tasks tasks={[firstTask, secondTask]} />)

    // sleep 200ms to wait for all tasks to finish
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Then
    expect(lastFrame()).toMatchInlineSnapshot(`
      "[31m████████████████████████████████████████████████████████████████████████████████[39m

      task 1
      "
    `)
  })
})
