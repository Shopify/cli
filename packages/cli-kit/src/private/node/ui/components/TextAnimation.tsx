/* eslint-disable id-length */
import {Text} from 'ink'
import React, {FunctionComponent, useCallback, useEffect, useRef, useState} from 'react'
import gradient from 'gradient-string'

interface TextAnimationProps {
  text: string
}

function rainbow(text: string, frame: number) {
  const hue = 5 * frame
  const leftColor = {h: hue % 360, s: 0.8, v: 1}
  const rightColor = {h: (hue + 1) % 360, s: 0.8, v: 1}
  return gradient(leftColor, rightColor)(text, {interpolation: 'hsv', hsvSpin: 'long'})
}

/**
 * `TextAnimation` applies a rainbow animation to text.
 */
const TextAnimation: FunctionComponent<TextAnimationProps> = ({text}): JSX.Element => {
  const frame = useRef(0)
  const [renderedFrame, setRenderedFrame] = useState(text)
  const timeout = useRef<NodeJS.Timeout>()

  const renderAnimation = useCallback(() => {
    const newFrame = frame.current + 1
    frame.current = newFrame

    setRenderedFrame(rainbow(text, frame.current))

    timeout.current = setTimeout(() => {
      renderAnimation()
    }, 35)
  }, [text])

  useEffect(() => {
    renderAnimation()

    return () => {
      clearTimeout(timeout.current)
    }
  }, [renderAnimation])

  return <Text>{renderedFrame}</Text>
}

export {TextAnimation}
