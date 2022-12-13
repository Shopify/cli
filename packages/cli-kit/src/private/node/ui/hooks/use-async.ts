import {useApp} from 'ink'
import {useEffect} from 'react'

interface Options {
  onResolve?: () => unknown
  onReject?: (error: Error) => void
}

export default function useAsync(
  asyncFunction: () => Promise<unknown>,
  {onResolve = () => {}, onReject = () => {}}: Options,
) {
  const {exit: unmountInk} = useApp()

  useEffect(() => {
    asyncFunction()
      .then(() => {
        onResolve()
        if (process.env.CI !== 'true') unmountInk()
      })
      .catch((error) => {
        onReject(error)
        unmountInk(error)
      })
  }, [])
}
