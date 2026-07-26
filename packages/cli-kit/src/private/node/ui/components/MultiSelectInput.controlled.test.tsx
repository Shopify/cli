import {MultiSelectInput} from './MultiSelectInput.js'
import {Item} from './SelectInput.js'
import {render, sendInputAndWait, sendInputAndWaitForChange, waitForInputsToBeReady} from '../../testing/ui.js'
import {unstyled} from '../../../../public/node/output.js'
import {describe, expect, test, vi} from 'vitest'
import figures from 'figures'

import React, {useState} from 'react'

const ENTER = '\r'
const SPACE = ' '
const ARROW_DOWN = '\u001B[B'

const CHOICES: Item<string>[] = [
  {label: 'read_products', value: 'read_products'},
  {label: 'read_orders', value: 'read_orders'},
  {label: 'read_customers', value: 'read_customers'},
]

// Holds the checked set outside MultiSelectInput, exactly as AutocompleteMultiSelectPrompt does, and
// exposes a `remountKey` so a test can force the child to remount while the parent's set stays put.
function ControlledHarness({
  remountKey,
  onSubmit,
  initialValues,
}: {
  remountKey: number
  onSubmit?: (items: Item<string>[]) => void
  initialValues?: string[]
}) {
  const [values, setValues] = useState<Set<string>>(() => new Set(initialValues ?? []))

  return (
    <MultiSelectInput
      key={remountKey}
      items={CHOICES}
      selectedValues={values}
      onSelectedValuesChange={setValues}
      onSubmit={onSubmit ?? (() => {})}
    />
  )
}

describe('MultiSelectInput controlled selection', () => {
  // T10: the invariant the two new props exist to protect. Every pre-existing caller passes neither
  // prop, so the component must behave exactly as it did before they were added.
  test('stays uncontrolled and self-managing when the new props are absent', async () => {
    const onSubmit = vi.fn()

    const renderInstance = render(<MultiSelectInput items={CHOICES} onSubmit={onSubmit} />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, SPACE)

    // The component owns the set, so the frame updates on its own.
    expect(unstyled(renderInstance.lastFrame()!)).toContain(`${figures.checkboxOn} read_products`)

    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, SPACE)
    await sendInputAndWait(renderInstance, 20, ENTER)

    expect(onSubmit).toHaveBeenCalledWith([CHOICES[0], CHOICES[1]])
  })

  // T11: when controlled, the component must hold NO selection state of its own — it reports the
  // next set upwards and renders whatever the parent hands back. A component that also kept an
  // internal set would update its own frame here; this test fails if that ever regresses.
  test('reports changes upwards and renders only the parent-provided set', async () => {
    const onSelectedValuesChange = vi.fn()

    const renderInstance = render(
      <MultiSelectInput
        items={CHOICES}
        selectedValues={new Set(['read_orders'])}
        onSelectedValuesChange={onSelectedValuesChange}
        onSubmit={() => {}}
      />,
    )

    await waitForInputsToBeReady()
    const frameBefore = renderInstance.lastFrame()

    // Focus is on the first row; toggling it must ADD to the parent's set, not replace it.
    await sendInputAndWait(renderInstance, 20, SPACE)

    expect(onSelectedValuesChange).toHaveBeenCalledTimes(1)
    expect(onSelectedValuesChange.mock.calls[0]![0]).toEqual(new Set(['read_orders', 'read_products']))

    // The parent here never updates the prop, so the frame must be unchanged: read_orders still
    // checked, read_products still unchecked.
    expect(renderInstance.lastFrame()).toEqual(frameBefore)
    const frame = unstyled(renderInstance.lastFrame()!)
    expect(frame).toContain(`${figures.checkboxOff} read_products`)
    expect(frame).toContain(`${figures.checkboxOn} read_orders`)
  })

  // T12: the reason the controlled props exist. A search box above the list swaps the items array,
  // which can remount this component; the checked set must not go with it.
  test('keeps the selection across a remount of the input', async () => {
    const onSubmit = vi.fn()

    const renderInstance = render(<ControlledHarness remountKey={0} onSubmit={onSubmit} />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, SPACE)
    expect(unstyled(renderInstance.lastFrame()!)).toContain(`${figures.checkboxOn} read_products`)

    renderInstance.rerender(<ControlledHarness remountKey={1} onSubmit={onSubmit} />)
    await waitForInputsToBeReady()

    // Fresh MultiSelectInput instance, same parent-owned set.
    expect(unstyled(renderInstance.lastFrame()!)).toContain(`${figures.checkboxOn} read_products`)

    await sendInputAndWait(renderInstance, 20, ENTER)
    expect(onSubmit).toHaveBeenCalledWith([CHOICES[0]])
  })

  test('seeds a controlled selection from the parent and submits it', async () => {
    const onSubmit = vi.fn()

    const renderInstance = render(
      <ControlledHarness remountKey={0} onSubmit={onSubmit} initialValues={['read_customers']} />,
    )

    await waitForInputsToBeReady()
    expect(unstyled(renderInstance.lastFrame()!)).toContain(`${figures.checkboxOn} read_customers`)

    await sendInputAndWait(renderInstance, 20, ENTER)
    expect(onSubmit).toHaveBeenCalledWith([CHOICES[2]])
  })
})
