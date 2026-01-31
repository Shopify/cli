type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    mobile?: boolean
  }
}

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false

  const navigatorWithUserAgentData = navigator as NavigatorWithUserAgentData
  if (navigatorWithUserAgentData.userAgentData?.mobile) return true

  const userAgent = navigator.userAgent ?? ''
  if (/(Android|iPhone|iPad|iPod)/i.test(userAgent)) return true

  // iPadOS 13+ uses a desktop-like UA but exposes touch points.
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true

  return false
}
