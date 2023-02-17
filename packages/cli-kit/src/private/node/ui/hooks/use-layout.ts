import {useStdout} from 'ink'

const MIN_WIDTH = 80

interface Layout {
  twoThirds: number
  oneThird: number
  fullWidth: number
}

export default function useLayout(): Layout {
  const {stdout} = useStdout()

  const fullWidth = stdout?.columns ?? MIN_WIDTH
  let oneThird
  let twoThirds

  if (fullWidth <= MIN_WIDTH) {
    oneThird = fullWidth
    twoThirds = fullWidth
  } else {
    oneThird = column({fullWidth, fraction: [1, 3], minWidth: MIN_WIDTH})
    twoThirds = column({fullWidth, fraction: [2, 3], minWidth: MIN_WIDTH})
  }

  return {
    twoThirds,
    oneThird,
    fullWidth,
  }
}

function column({
  fullWidth,
  fraction,
  minWidth,
}: {
  fullWidth: number
  fraction: [number, number]
  minWidth: number
}): number {
  const fractionedWidth = Math.floor((fullWidth / fraction[1]) * fraction[0])

  if (fractionedWidth < minWidth) {
    return minWidth
  } else {
    return fractionedWidth
  }
}
