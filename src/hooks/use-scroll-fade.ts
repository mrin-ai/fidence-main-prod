"use client"

import * as React from "react"

export function useScrollFade(deps: React.DependencyList = []) {
  const [showBottomFade, setShowBottomFade] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const updateScrollFade = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const hasOverflow = el.scrollHeight > el.clientHeight + 1
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8
    setShowBottomFade(hasOverflow && !atBottom)
  }, [])

  React.useEffect(() => {
    updateScrollFade()

    const el = scrollRef.current
    if (!el) return

    el.addEventListener("scroll", updateScrollFade, { passive: true })
    window.addEventListener("resize", updateScrollFade)

    return () => {
      el.removeEventListener("scroll", updateScrollFade)
      window.removeEventListener("resize", updateScrollFade)
    }
  }, [updateScrollFade, ...deps])

  return { scrollRef, showBottomFade }
}
