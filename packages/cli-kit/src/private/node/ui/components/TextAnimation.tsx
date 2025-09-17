/* eslint-disable id-length */
import {Text, useStdout} from 'ink'
import React, {memo, useCallback, useLayoutEffect, useRef, useState} from 'react'
import gradient from 'gradient-string'

interface TextAnimationProps {
  text: string
  maxWidth?: number
  isStatic?: boolean
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
const TextAnimation = memo(({text, maxWidth, isStatic}: TextAnimationProps): JSX.Element => {
  const frame = useRef(0)
  const timeout = useRef<NodeJS.Timeout>()
  const {stdout} = useStdout()
  const [width, setWidth] = useState(maxWidth ?? Math.floor(stdout.columns * 0.66))
  const [renderedFrame, setRenderedFrame] = useState(rainbow(truncated(rotated(text, 1), width), 1))

  useLayoutEffect(() => {
    const handleResize = () => {
      setWidth(Math.floor(stdout.columns * 0.66))
    }

    stdout.on('resize', handleResize)

    return () => {
      stdout.off('resize', handleResize)
    }
  }, [stdout])

  const renderAnimation = useCallback(() => {
    const newFrame = frame.current + 1
    frame.current = newFrame

    if (!isStatic) {
      setRenderedFrame(rainbow(truncated(rotated(text, frame.current), width), frame.current))
    }

    timeout.current = setTimeout(() => {
      renderAnimation()
    }, 35)
  }, [text, width, isStatic])

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
