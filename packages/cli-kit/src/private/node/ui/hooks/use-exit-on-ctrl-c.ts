import {handleCtrlC} from '../../ui.js'
import {useInput, useStdin} from 'ink'

/**
 * This hook will cause the process to exit when the user presses Ctrl+C.
 */
export function useExitOnCtrlC() {
  const {isRawModeSupported} = useStdin()
  useInput(
    (input, key) => {
      handleCtrlC(input, key)
      if (key.return) {
        return null
      }
    },
    {isActive: Boolean(isRawModeSupported)},
  )
}
