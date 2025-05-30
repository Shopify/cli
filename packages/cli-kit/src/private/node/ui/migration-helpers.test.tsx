import {
  createColorToken,
  createJsonToken,
  createIconToken,
  createDebugToken,
  MigratedText,
  GreenText,
  YellowText,
  CyanText,
  MagentaText,
  GrayText,
  SuccessIcon,
  FailIcon,
} from './migration-helpers.js'
import {render} from '../testing/ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('Migration Helpers', async () => {
  test('createColorToken creates valid color tokens', () => {
    const token = createColorToken('SUCCESS', 'green')
    expect(token).toEqual({
      color: {
        text: 'SUCCESS',
        color: 'green',
      },
    })
  })

  test('createJsonToken creates valid json tokens', () => {
    const data = {key: 'value', number: 42}
    const token = createJsonToken(data)
    expect(token).toEqual({
      json: data,
    })
  })

  test('createIconToken creates valid icon tokens', () => {
    const token = createIconToken('success')
    expect(token).toEqual({
      icon: 'success',
    })
  })

  test('createDebugToken creates valid debug tokens', () => {
    const token = createDebugToken('debug message')
    expect(token).toEqual({
      debug: 'debug message',
    })
  })

  test('MigratedText renders complex content correctly', async () => {
    const content = [
      createColorToken('SUCCESS', 'green'),
      ' App deployed to ',
      {filePath: '/apps/my-app'},
      ' Run ',
      {command: 'npm start'},
    ]

    const {lastFrame} = render(<MigratedText content={content} />)

    expect(lastFrame()).toContain('SUCCESS')
    expect(lastFrame()).toContain('App deployed to')
    expect(lastFrame()).toContain('/apps/my-app')
    expect(lastFrame()).toContain('npm start')
  })

  test('Direct color components render correctly', async () => {
    const {lastFrame: green} = render(<GreenText>Success!</GreenText>)
    expect(green()).toMatchInlineSnapshot(`"[32mSuccess![39m"`)

    const {lastFrame: yellow} = render(<YellowText>Warning!</YellowText>)
    expect(yellow()).toMatchInlineSnapshot(`"[33mWarning![39m"`)

    const {lastFrame: cyan} = render(<CyanText>Info!</CyanText>)
    expect(cyan()).toMatchInlineSnapshot(`"[36mInfo![39m"`)

    const {lastFrame: magenta} = render(<MagentaText>Highlight!</MagentaText>)
    expect(magenta()).toMatchInlineSnapshot(`"[35mHighlight![39m"`)

    const {lastFrame: gray} = render(<GrayText>Subdued!</GrayText>)
    expect(gray()).toMatchInlineSnapshot(`"[90mSubdued![39m"`)
  })

  test('Icon shortcuts render correctly', async () => {
    const {lastFrame: success} = render(<SuccessIcon />)
    expect(success()).toMatchInlineSnapshot(`"[32m✓[39m"`)

    const {lastFrame: fail} = render(<FailIcon />)
    expect(fail()).toMatchInlineSnapshot(`"[31m✗[39m"`)
  })
})
