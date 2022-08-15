import {useEffect, useLayoutEffect} from 'react'

const isSSR =
  typeof window === 'undefined' || !window.navigator || /ServerSideRendering|^Deno\//.test(window.navigator.userAgent)

export const useIsomorphicLayoutEffect = isSSR ? useEffect : useLayoutEffect
