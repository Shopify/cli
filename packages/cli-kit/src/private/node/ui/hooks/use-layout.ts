import {useStdout} from 'ink'

const MIN_WIDTH = 80

export default function useLayout() {
  const {stdout} = useStdout()

  const fullWidth = stdout?.columns ?? MIN_WIDTH
  const twoThirdsOfWidth = Math.floor((fullWidth / 3) * 2)
  let width

  if (fullWidth <= MIN_WIDTH) {
    width = fullWidth
  } else if (twoThirdsOfWidth < MIN_WIDTH) {
    width = MIN_WIDTH
  } else {
    width = twoThirdsOfWidth
  }

  return {
    width,
  }
}
