/* eslint-disable id-length */
import {Text} from 'ink'
import React, {useEffect, useRef, useState} from 'react'
import gradient from 'gradient-string'

interface Props {
  text: string
}

function rainbow(text: string, frame: number) {
  const hue = 5 * frame
  const leftColor = {h: hue % 360, s: 0.5, v: 1}
  const rightColor = {h: (hue + 1) % 360, s: 0.5, v: 1}
  return gradient(leftColor, rightColor)(text, {interpolation: 'hsv', hsvSpin: 'long'})
}

/**
 * `TextAnimation` applies a rainbow animation to text.
 */
const TextAnimation: React.FC<Props> = ({text}): JSX.Element => {
  const frame = useRef(0)
  const [renderedFrame, setRenderedFrame] = useState(text)
  const timeout = useRef<NodeJS.Timeout>()

  const renderAnimation = () => {
    const newFrame = frame.current + 1
    frame.current = newFrame

    setRenderedFrame(rainbow(text, frame.current))

    timeout.current = setTimeout(() => {
      renderAnimation()
    }, 40)
  }

  useEffect(() => {
    renderAnimation()

    return () => {
      clearTimeout(timeout.current)
    }
  }, [])

  return <Text>{renderedFrame}</Text>
}

export {TextAnimation}
