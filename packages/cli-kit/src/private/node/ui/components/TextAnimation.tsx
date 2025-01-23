/* eslint-disable id-length */
import {Text} from 'ink'
import React, {memo, useCallback, useLayoutEffect, useRef, useState} from 'react'
import gradient from 'gradient-string'

interface TextAnimationProps {
  text: string
  maxWidth?: number
}

function rainbow(text: string, frame: number) {
  const hue = 5 * frame
  const leftColor = {h: hue % 360, s: 0.8, v: 1}
  const rightColor = {h: (hue + 1) % 360, s: 0.8, v: 1}
  return gradient(leftColor, rightColor)(text, {interpolation: 'hsv', hsvSpin: 'long'})
}

function rotated(text: string, steps: number) {
  const normalizedSteps = steps % text.length
  const start = text.slice(-normalizedSteps)
  const end = text.slice(0, -normalizedSteps)
  return start + end
}

function truncated(text: string, maxWidth: number | undefined): string {
  return maxWidth ? text.slice(0, maxWidth) : text
}

/**
 * `TextAnimation` applies a rainbow animation to text.
 */
const TextAnimation = memo(({text, maxWidth}: TextAnimationProps): JSX.Element => {
  const frame = useRef(0)
  const [renderedFrame, setRenderedFrame] = useState(text)
  const timeout = useRef<NodeJS.Timeout>()

  const renderAnimation = useCallback(() => {
    const newFrame = frame.current + 1
    frame.current = newFrame

    setRenderedFrame(rainbow(truncated(rotated(text, frame.current), maxWidth), frame.current))

    timeout.current = setTimeout(() => {
      renderAnimation()
    }, 35)
  }, [text, maxWidth])

  useLayoutEffect(() => {
    renderAnimation()

    return () => {
      clearTimeout(timeout.current)
    }
  }, [renderAnimation])

  return <Text>{renderedFrame}</Text>
})

TextAnimation.displayName = 'TextAnimation'

export {TextAnimation}
