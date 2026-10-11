"use client"

import { useEffect, useRef, useState } from "react"

const LOCAL_LOGO = "/logo.png"
// Used only until public/logo.png exists in the project.
const FALLBACK_LOGO = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-KHwywXUeXAt6gKRaUvSyojic08od8c.png"

export function BrandLogo() {
  const [src, setSrc] = useState(LOCAL_LOGO)
  const imageRef = useRef<HTMLImageElement>(null)

  // The server-rendered <img> can fail before React attaches onError, so also check once on mount.
  useEffect(() => {
    const image = imageRef.current
    if (image && image.complete && image.naturalWidth === 0) setSrc(FALLBACK_LOGO)
  }, [])

  return (
    <img
      ref={imageRef}
      src={src}
      onError={() => setSrc((current) => (current === LOCAL_LOGO ? FALLBACK_LOGO : current))}
      alt="TechIs colorful geometric logo"
      className="size-full object-cover"
    />
  )
}
