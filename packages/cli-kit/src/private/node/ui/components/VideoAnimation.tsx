import useAbortSignal from '../hooks/use-abort-signal.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import {sleep} from '../../../../public/node/system.js'
import React, {useRef, useState, useCallback, useEffect} from 'react'
import {Box, Text, useInput} from 'ink'
import PlaySound from 'play-sound'
import terminalImage from 'terminal-image'
import {parseSync as parseCaptions} from 'subtitle'
import {readFile} from '../../../../public/node/fs.js'
import {unstyled} from '../../../../public/node/output.js'
import {handleCtrlC} from '../../ui.js'

type AudioPlayer = ReturnType<Awaited<typeof PlaySound>>

let _audioPlayer: AudioPlayer

async function audioPlayer(): Promise<AudioPlayer> {
  if (!_audioPlayer) {
    _audioPlayer = (await import('play-sound')).default()
  }
  return _audioPlayer
}

interface PlayResults {
  kill: () => void
}

async function playAudio(path: string): Promise<PlayResults> {
  const audio = (await audioPlayer()).play(path)
  return {
    kill: audio.kill.bind(audio),
  }
}

interface PlayGifOptions {
  path: string
  maxWidth?: number
  renderFrame: (text: string) => void
}

async function playGif({path, maxWidth, renderFrame}: PlayGifOptions): Promise<PlayResults> {
  let stopper = terminalImage.gifFile(path, {
    width: maxWidth ?? '30%',
    maximumFrameRate: 15,
    renderFrame,
  })
  return {kill: stopper}
}

interface PlayAsVideoOptions {
  audioPath?: string
  videoPath: string
  captionsPath?: string
  duration?: number
  maxWidth?: number
  setContents: (contents: string) => void
  setCaption: (caption: string) => void
}

async function playAsVideo({audioPath, videoPath, captionsPath, maxWidth, setContents, setCaption}: PlayAsVideoOptions): Promise<PlayResults> {
  const audio = audioPath ? await playAudio(audioPath) : undefined
  let killVideo: () => void
  let videoStartTime = Date.now()
  let videoStopped = false
  if (videoPath) {
    if (videoPath.endsWith('.gif')) {
      const video = await playGif({
        path: videoPath,
        maxWidth,
        renderFrame: (text: string) => {
          setContents(text.trim())
        },
      })
      killVideo = () => {
        videoStopped = true
        video.kill()
      }
    } else if (videoPath.endsWith('.json')) {
      const {frames, frameRate} = JSON.parse(await readFile(videoPath, {encoding: 'utf8'}))
      ;(async () => {
        while (!videoStopped) {
          const currentFrameNumber = Math.floor((Date.now() - videoStartTime) / 1000 * frameRate) % frames.length
          const currentFrame = frames[currentFrameNumber]
          setContents(currentFrame)
          await sleep(0.02)
        }
      })()
      killVideo = () => {
        videoStopped = true
      }
    }
  }
  if (captionsPath) {
    (async () => {
      for (const node of parseCaptions(await readFile(captionsPath, {encoding: 'utf8'}))) {
        if (node.type === 'cue') {
          while (Date.now() - videoStartTime < node.data.start) {
            await sleep(0.05)
          }
          if (videoStopped) {
            return
          }
          setCaption(node.data.text)
        }
      }
    })()
  }
  return {
    kill: () => {
      audio?.kill()
      killVideo()
    }
  }
}

export interface VideoAnimationProps {
  audioPath?: string
  videoPath: string
  captionsPath?: string
  duration?: number
  maxWidth?: number
  hideKey?: string
  abortSignal?: AbortSignal
  onComplete?: () => void
}

/**
 * `VideoAnimation` plays a video in a box.
 */
export function VideoAnimation({audioPath, videoPath, captionsPath, duration, maxWidth, hideKey, abortSignal, onComplete}: VideoAnimationProps): JSX.Element | null {
  const isPlaying = useRef(false)
  const [contents, setContents] = useState<string>('')
  const [caption, setCaption] = useState<string>('')
  const kill = useRef<(() => void) | undefined>(undefined)
  const maxBoxWidth = useRef<number>(0)
  const {isAborted} = useAbortSignal(abortSignal)

  if (isAborted) {
    try {
      kill.current?.()
    } catch (error) {
      // ignore
    }
  }

  const playVideo = useCallback(async () => {
    if (isPlaying.current) {
      return
    }
    isPlaying.current = true
    const {kill: killFunc} = await playAsVideo({audioPath, videoPath, captionsPath, maxWidth, setContents, setCaption})
    kill.current = () => {
      killFunc()
      isPlaying.current = false
      setContents("")
      setCaption("")
      onComplete?.()
    }
    if (typeof duration === 'number') {
      const killTimeout = setTimeout(kill.current, duration)
      const pingInterval = setInterval(() => {
        if (!isPlaying.current) {
          clearInterval(pingInterval)
          clearTimeout(killTimeout)
          kill.current?.()
        }
      }, 20)
    }
  }, [audioPath, videoPath, duration, maxWidth])

  useEffect(() => {
    const originalTermProgram = process.env.TERM_PROGRAM
    // Set to another program temporarily, to ensure terminal-image won't try any
    // iTerm-specific features.
    process.env.TERM_PROGRAM = 'Apple_Terminal'

    playVideo()

    return () => {
      kill.current?.()
      process.env.TERM_PROGRAM = originalTermProgram
    }
  }, [playVideo])

  useInput((input, key) => {
    handleCtrlC(input, key)

    if (input === hideKey) {
      kill.current?.()
    }
  })

  const boxWidth = (contents ? Math.max(...unstyled(contents).split('\n').map(line => line.length)) : 0) ?? 0
  if (boxWidth > maxBoxWidth.current) {
    maxBoxWidth.current = boxWidth
  }

  return (
    (isAborted || !isPlaying.current) ? null : <Box flexDirection="column" width={maxBoxWidth.current}>
      <Box width={contents?.length ?? 0}>
        <Text wrap="truncate">{contents}</Text>
      </Box>
      {(captionsPath || hideKey) ?
        <Box width={maxBoxWidth.current} minHeight={3} gap={1} flexDirection="column" justifyContent="center" borderStyle="double">
          {caption ? <Box width="100%" flexDirection="row" justifyContent="center"><Text>{caption}</Text></Box> : null}
          {hideKey ? <Box width="100%" flexDirection="row" justifyContent="center"><Text>Press <Text bold>{hideKey}</Text> to hide</Text></Box> : null}
        </Box> : null}
    </Box>
  )
}
