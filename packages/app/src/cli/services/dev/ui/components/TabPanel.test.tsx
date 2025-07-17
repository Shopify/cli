import {TabPanel, Tab} from './TabPanel.js'
import {render, sendInputAndWait, waitForInputsToBeReady} from '@shopify/cli-kit/node/testing/ui'
import React from 'react'
import {describe, expect, test, vi} from 'vitest'
import {unstyled} from '@shopify/cli-kit/node/output'
import {Text} from '@shopify/cli-kit/node/ink'

const mocks = vi.hoisted(() => {
  return {
    useStdin: vi.fn(() => {
      return {isRawModeSupported: true}
    }),
  }
})

vi.mock('@shopify/cli-kit/node/ink', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/node/ink')
  return {
    ...actual,
    useStdin: mocks.useStdin,
  }
})

describe('TabPanel', () => {
  const mockAction = vi.fn()
  const mockShortcutAction = vi.fn()

  const sampleTabs: {[key: string]: Tab} = {
    // eslint-disable-next-line id-length
    a: {
      label: 'First Tab',
      content: <Text>First tab content</Text>,
      shortcuts: [
        {
          key: 'x',
          action: mockShortcutAction,
        },
      ],
    },
    // eslint-disable-next-line id-length
    b: {
      label: 'Second Tab',
      content: <Text>Second tab content</Text>,
    },
    // eslint-disable-next-line id-length
    c: {
      label: 'Action Tab',
      action: mockAction,
    },
  }

  test('renders tab headers with box drawing characters', async () => {
    const renderInstance = render(<TabPanel tabs={sampleTabs} initialActiveTab="a" />)

    await waitForInputsToBeReady()

    const output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('╒═══════════════')
    expect(output).toContain('(a) First Tab')
    expect(output).toContain('(b) Second Tab')
    expect(output).toContain('(c) Action Tab')
    expect(output).toContain('└───────────────')

    renderInstance.unmount()
  })

  test('shows initial active tab content', async () => {
    const renderInstance = render(<TabPanel tabs={sampleTabs} initialActiveTab="a" />)

    await waitForInputsToBeReady()

    const output = renderInstance.lastFrame()!
    expect(output).toContain('First tab content')
    expect(output).not.toContain('Second tab content')

    renderInstance.unmount()
  })

  test('switches to different tab when tab key is pressed', async () => {
    const renderInstance = render(<TabPanel tabs={sampleTabs} initialActiveTab="a" />)

    await waitForInputsToBeReady()

    // Initially shows first tab
    expect(renderInstance.lastFrame()!).toContain('First tab content')

    // Press 'b' to switch to second tab
    await sendInputAndWait(renderInstance, 100, 'b')

    expect(renderInstance.lastFrame()!).toContain('Second tab content')
    expect(renderInstance.lastFrame()!).not.toContain('First tab content')

    renderInstance.unmount()
  })

  test('executes tab action when action tab is pressed', async () => {
    const renderInstance = render(<TabPanel tabs={sampleTabs} initialActiveTab="a" />)

    await waitForInputsToBeReady()

    // Press 'c' to trigger action tab
    await sendInputAndWait(renderInstance, 100, 'c')

    expect(mockAction).toHaveBeenCalledOnce()

    renderInstance.unmount()
  })

  test('executes shortcut action when shortcut key is pressed', async () => {
    const renderInstance = render(<TabPanel tabs={sampleTabs} initialActiveTab="a" />)

    await waitForInputsToBeReady()

    // Press 'x' to trigger shortcut in active tab
    await sendInputAndWait(renderInstance, 100, 'x')

    expect(mockShortcutAction).toHaveBeenCalledOnce()

    renderInstance.unmount()
  })

  test('only executes shortcuts for the active tab', async () => {
    const secondTabShortcut = vi.fn()
    const tabsWithMultipleShortcuts: {[key: string]: Tab} = {
      // eslint-disable-next-line id-length
      a: {
        label: 'First Tab',
        content: <Text>First tab content</Text>,
        shortcuts: [{key: 'x', action: mockShortcutAction}],
      },
      // eslint-disable-next-line id-length
      b: {
        label: 'Second Tab',
        content: <Text>Second tab content</Text>,
        shortcuts: [{key: 'y', action: secondTabShortcut}],
      },
    }

    const renderInstance = render(<TabPanel tabs={tabsWithMultipleShortcuts} initialActiveTab="a" />)

    await waitForInputsToBeReady()

    // Press 'y' while on tab 'a' - should not trigger second tab's shortcut
    await sendInputAndWait(renderInstance, 100, 'y')
    expect(secondTabShortcut).not.toHaveBeenCalled()

    // Switch to tab 'b' and press 'y' - should trigger second tab's shortcut
    await sendInputAndWait(renderInstance, 100, 'b')
    await sendInputAndWait(renderInstance, 100, 'y')
    expect(secondTabShortcut).toHaveBeenCalledOnce()

    renderInstance.unmount()
  })

  test('respects shortcut conditions', async () => {
    const conditionMet = vi.fn().mockReturnValue(true)
    const conditionNotMet = vi.fn().mockReturnValue(false)
    const actionWhenConditionMet = vi.fn()
    const actionWhenConditionNotMet = vi.fn()

    const tabsWithConditions: {[key: string]: Tab} = {
      // eslint-disable-next-line id-length
      a: {
        label: 'Conditional Tab',
        content: <Text>Conditional tab content</Text>,
        shortcuts: [
          {
            key: 'x',
            condition: conditionMet,
            action: actionWhenConditionMet,
          },
          {
            key: 'y',
            condition: conditionNotMet,
            action: actionWhenConditionNotMet,
          },
        ],
      },
    }

    const renderInstance = render(<TabPanel tabs={tabsWithConditions} initialActiveTab="a" />)

    await waitForInputsToBeReady()

    // Press 'x' - condition is met, action should execute
    await sendInputAndWait(renderInstance, 100, 'x')
    expect(conditionMet).toHaveBeenCalled()
    expect(actionWhenConditionMet).toHaveBeenCalledOnce()

    // Press 'y' - condition is not met, action should not execute
    await sendInputAndWait(renderInstance, 100, 'y')
    expect(conditionNotMet).toHaveBeenCalled()
    expect(actionWhenConditionNotMet).not.toHaveBeenCalled()

    renderInstance.unmount()
  })

  test('defaults to first tab when no initialActiveTab provided', async () => {
    const renderInstance = render(<TabPanel tabs={sampleTabs} />)

    await waitForInputsToBeReady()

    // Should show first tab content by default (falls back to first key)
    expect(renderInstance.lastFrame()!).toContain('First tab content')

    renderInstance.unmount()
  })

  test('highlights active tab in the UI', async () => {
    const renderInstance = render(<TabPanel tabs={sampleTabs} initialActiveTab="a" />)

    await waitForInputsToBeReady()

    // Check that the active tab is highlighted (this is visual, hard to test fully)
    const output = renderInstance.lastFrame()!
    expect(output).toContain('(a) First Tab')

    // Switch to second tab
    await sendInputAndWait(renderInstance, 100, 'b')

    // The display should update to show the new active tab
    expect(renderInstance.lastFrame()!).toContain('Second tab content')

    renderInstance.unmount()
  })

  test('disables input handling when raw mode is not supported', async () => {
    mocks.useStdin.mockReturnValue({isRawModeSupported: false})

    const renderInstance = render(<TabPanel tabs={sampleTabs} initialActiveTab="a" />)
    await waitForInputsToBeReady()

    // Initially shows first tab
    expect(renderInstance.lastFrame()!).toContain('First tab content')

    // Press 'b' - should not switch tabs since input is disabled
    await sendInputAndWait(renderInstance, 100, 'b')
    expect(renderInstance.lastFrame()!).toContain('First tab content')
    expect(renderInstance.lastFrame()!).not.toContain('Second tab content')

    // Restore mock for other tests
    mocks.useStdin.mockReturnValue({isRawModeSupported: true})

    renderInstance.unmount()
  })
})
