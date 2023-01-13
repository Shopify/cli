import {Tasks} from './Tasks.js'
import {getLastFrameAfterUnmount} from '../../../../testing/ui.js'
import {unstyled} from '../../../../output.js'
import React from 'react'
import {describe, expect, test} from 'vitest'
import {render} from 'ink-testing-library'

describe('Tasks', () => {
  test('shows a loading state at the start', async () => {
    // Given
    const firstTask = {
      title: 'task 1',
      task: async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      },
    }

    // When
    const renderInstance = render(<Tasks tasks={[firstTask]} />)
    // wait for next tick
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Then
    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toMatchInlineSnapshot(`
      "████████████████████████████████████████████████████████████████████████████████
      task 1 ..."
    `)
  })

  test('shows nothing at the end in case of success', async () => {
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
    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot('""')
  })

  test('shows nothing at the end in case of failure', async () => {
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
    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot('""')
  })

  test('it supports subtasks', async () => {
    // Given
    const firstTask = {
      title: 'task 1',
      task: async () => {
        return [
          {
            title: 'subtask 1',
            task: async () => {
              await new Promise((resolve) => setTimeout(resolve, 2000))
            },
          },
          {
            title: 'subtask 2',
            task: async () => {},
          },
        ]
      },
    }

    const secondTask = {
      title: 'task 2',
      task: async () => {},
    }

    // When
    const renderInstance = render(<Tasks tasks={[firstTask, secondTask]} />)

    // wait for next tick
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Then
    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toMatchInlineSnapshot(`
      "████████████████████████████████████████████████████████████████████████████████
      subtask 1 ..."
    `)
  })
})
