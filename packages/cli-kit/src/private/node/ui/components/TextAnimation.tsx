import {renderString} from '../../ui.js'
import chalkAnimation from 'chalk-animation'
import {Text} from 'ink'
import React, {useEffect, useState} from 'react'

type AnimationName = 'rainbow' | 'pulse' | 'glitch' | 'radar' | 'neon' | 'karaoke'

interface Props {
  name?: AnimationName
  speed?: number
}

const delays: {[key in AnimationName]: number} = {
  rainbow: 15,
  pulse: 16,
  glitch: 55,
  radar: 50,
  neon: 500,
  karaoke: 50,
}

/**
 * `TextAnimation` applies animations from [chalk-animation](https://github.com/bokub/chalk-animation) to `Text` Children
 */
const TextAnimation: React.FC<Props> = ({name = 'rainbow', speed = 1, children}): JSX.Element => {
  const [animationTimeout, setAnimationTimeout] = useState<NodeJS.Timeout | null>(null)
  const animation = chalkAnimation[name]('').stop()
  const [frame, setFrame] = useState('')

  const start = () => {
    const {output} = renderString(<Text>{children}</Text>)

    // There's probably some clashing between `chalk-animation` and Ink's rendering mechanism
    // (which uses `log-update`). The solution is to remove the ANSI escape sequence at the
    // start of the frame that we're getting from `chalk-animation` that tells the terminal to
    // clear the lines.

    const frame = animation
      .replace(output ?? '')
      .frame()
      .replace(/^\u001B\[(\d)F\u001B\[G\u001B\[2K/, '') // eslint-disable-line no-control-regex

    setFrame(frame)

    setAnimationTimeout(
      setTimeout(() => {
        start()
      }, delays[name] / speed),
    )
  }

  useEffect(() => {
    start()

    return () => {
      if (animationTimeout) clearTimeout(animationTimeout)

      setAnimationTimeout(null)
    }
  }, [])

  return <Text>{frame}</Text>
}

export {TextAnimation}
