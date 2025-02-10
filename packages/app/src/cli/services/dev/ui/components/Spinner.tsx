import React, {useEffect, useState} from 'react'
import {Text} from '@shopify/cli-kit/node/ink'

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function Spinner() {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((previousFrame) => (previousFrame + 1) % frames.length)
    }, 70)

    return () => clearInterval(timer)
  }, [])

  return <Text>{frames[frame]}</Text>
}
