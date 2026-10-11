"use client"

import { useEffect, useState } from "react"

const COLORS = ["#10d7ac", "#4cbce0", "#ffd169", "#f57796", "#c4d1de", "#ffffff"]

type Piece = { left: number; size: number; color: string; delay: number; duration: number; drift: number; spin: number; round: boolean }

/** A one-time burst of falling confetti. Pieces are created on the client to avoid hydration mismatches. */
export function Confetti({ active, count = 70 }: { active: boolean; count?: number }) {
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    if (!active) return
    setPieces(Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      size: 6 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 1.6,
      duration: 3.2 + Math.random() * 2.4,
      drift: (Math.random() - 0.5) * 220,
      spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
      round: Math.random() > 0.65,
    })))
    const timer = window.setTimeout(() => setPieces([]), 8000)
    return () => window.clearTimeout(timer)
  }, [active, count])

  if (!active || pieces.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden="true">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.round ? piece.size : piece.size * 0.55,
            borderRadius: piece.round ? "9999px" : undefined,
            backgroundColor: piece.color,
            ["--confetti-delay" as string]: `${piece.delay}s`,
            ["--confetti-duration" as string]: `${piece.duration}s`,
            ["--confetti-drift" as string]: `${piece.drift}px`,
            ["--confetti-spin" as string]: `${piece.spin}deg`,
          }}
        />
      ))}
    </div>
  )
}
