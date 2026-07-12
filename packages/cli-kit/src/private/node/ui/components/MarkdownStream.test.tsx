import {MarkdownStream} from './MarkdownStream.js'
import {render} from '../../testing/ui.js'
import React from 'react'

import {describe, expect, test} from 'vitest'

describe('MarkdownStream', () => {
  test('renders content pushed via updateContent, styled as Markdown', async () => {
    let resolveTask: (value: string) => void
    const task = (updateContent: (content: string) => void) =>
      new Promise<string>((resolve) => {
        updateContent('Run **shopify app dev**')
        resolveTask = resolve
      })

    const renderInstance = render(<MarkdownStream task={task} />)

    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(renderInstance.lastFrame()).toContain('shopify app dev')

    resolveTask!('done')
    await renderInstance.waitUntilExit()
  })

  test('keeps the final content on screen once the task completes', async () => {
    const task = (updateContent: (content: string) => void) => {
      updateContent('# Final answer')
      return Promise.resolve('done')
    }

    const renderInstance = render(<MarkdownStream task={task} />)
    await renderInstance.waitUntilExit()

    expect(renderInstance.lastFrame()).toContain('Final answer')
  })

  test('passes the task result to onComplete', async () => {
    let result: string | undefined
    const task = () => Promise.resolve('the answer')

    const renderInstance = render(<MarkdownStream task={task} onComplete={(value) => (result = value)} />)
    await renderInstance.waitUntilExit()

    expect(result).toBe('the answer')
  })

  test('exits with the task error when the task rejects', async () => {
    const task = () => Promise.reject(new Error('assistant failed'))

    const renderInstance = render(<MarkdownStream task={task} />)

    await expect(renderInstance.waitUntilExit()).rejects.toThrow('assistant failed')
  })
})
