"use client"

import { Volume2, VolumeX } from "lucide-react"
import { usePathname } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

/**
 * Every sound effect the game can play. The value is the file in /public/sounds
 * and the default volume (0 to 1). Swap the mp3s any time, no code changes needed.
 */
const SOUNDS = {
  playerJoin: { src: "/sounds/player-join.mp3", volume: 0.55 },
  gameStart: { src: "/sounds/game-start.mp3", volume: 0.55 },
  timerTick: { src: "/sounds/timer-tick.mp3", volume: 0.22 },
  timerUrgent: { src: "/sounds/timer-urgent.mp3", volume: 0.5 },
  timeUp: { src: "/sounds/time-up.mp3", volume: 0.5 },
  answerSelect: { src: "/sounds/answer-select.mp3", volume: 0.5 },
  reveal: { src: "/sounds/reveal.mp3", volume: 0.55 },
  correct: { src: "/sounds/correct.mp3", volume: 0.5 },
  wrong: { src: "/sounds/wrong.mp3", volume: 0.5 },
  pointsTally: { src: "/sounds/points-tally.mp3", volume: 0.45 },
  podiumFanfare: { src: "/sounds/podium-fanfare.mp3", volume: 0.6 },
} as const

export type GameSound = keyof typeof SOUNDS

// Background music is kept deliberately quiet and fades in so nobody is startled.
const LOBBY_BGM = { src: "/sounds/lobby-bgm.mp3", volume: 0.18 }
const BGM_FADE_IN_MS = 2500
const STORAGE_KEY = "techis-audio-enabled"

type GameAudioContextValue = {
  isAudioEnabled: boolean
  enableAudio: () => void
  toggleAudio: () => void
  startLobbyMusic: () => void
  stopLobbyMusic: () => void
  playSound: (sound: GameSound) => void
}

const GameAudioContext = createContext<GameAudioContextValue | null>(null)

export function GameAudioProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  // Sound is on by default; a person who mutes it keeps it muted (remembered in this browser).
  const [isAudioEnabled, setAudioEnabled] = useState(true)
  const enabledRef = useRef(true)
  const fadeInRef = useRef<number | null>(null)
  const sfxCache = useRef(new Map<GameSound, HTMLAudioElement>())
  const bgmRef = useRef<HTMLAudioElement | null>(null)
  const bgmWanted = useRef(false)

  // Restore the saved mute preference. Browsers still need one tap before the first sound can play.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      const enabled = saved !== "0"
      enabledRef.current = enabled
      setAudioEnabled(enabled)
    } catch { /* storage unavailable */ }
  }, [])

  const getBgm = useCallback(() => {
    if (!bgmRef.current) {
      const audio = new Audio(LOBBY_BGM.src)
      audio.loop = true
      audio.volume = LOBBY_BGM.volume
      audio.preload = "auto"
      bgmRef.current = audio
    }
    return bgmRef.current
  }, [])

  const tryPlayBgm = useCallback(() => {
    if (!enabledRef.current || !bgmWanted.current) return
    const bgm = getBgm()
    if (!bgm.paused) return
    if (fadeInRef.current) window.clearInterval(fadeInRef.current)
    bgm.volume = 0
    void bgm.play().then(() => {
      // ramp from silence to the target volume
      const startedAt = performance.now()
      fadeInRef.current = window.setInterval(() => {
        const progress = Math.min(1, (performance.now() - startedAt) / BGM_FADE_IN_MS)
        bgm.volume = LOBBY_BGM.volume * progress
        if (progress >= 1 && fadeInRef.current) { window.clearInterval(fadeInRef.current); fadeInRef.current = null }
      }, 50)
    }).catch(() => { /* blocked until the user taps; retried on first interaction */ })
  }, [getBgm])

  const stopLobbyMusic = useCallback(() => {
    bgmWanted.current = false
    if (fadeInRef.current) { window.clearInterval(fadeInRef.current); fadeInRef.current = null }
    const bgm = bgmRef.current
    if (!bgm || bgm.paused) return
    // short fade-out so the music doesn't cut off abruptly
    let volume = bgm.volume
    const fade = window.setInterval(() => {
      volume = Math.max(0, volume - 0.07)
      bgm.volume = volume
      if (volume <= 0) {
        window.clearInterval(fade)
        if (!bgmWanted.current) { bgm.pause(); bgm.currentTime = 0 }
      }
    }, 40)
  }, [])

  const startLobbyMusic = useCallback(() => {
    bgmWanted.current = true
    tryPlayBgm()
  }, [tryPlayBgm])

  const playSound = useCallback((sound: GameSound) => {
    if (!enabledRef.current) return
    const config = SOUNDS[sound]
    let base = sfxCache.current.get(sound)
    if (!base) {
      base = new Audio(config.src)
      base.preload = "auto"
      sfxCache.current.set(sound, base)
    }
    // clone so rapid repeats (ticks, taps) can overlap instead of cutting each other off
    const instance = base.cloneNode(true) as HTMLAudioElement
    instance.volume = config.volume
    void instance.play().catch(() => { /* autoplay blocked; ignore */ })
  }, [])

  // If music was requested before the browser allowed audio, start it on the first tap/key.
  useEffect(() => {
    const unlock = () => tryPlayBgm()
    window.addEventListener("pointerdown", unlock)
    window.addEventListener("keydown", unlock)
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [tryPlayBgm])

  const setEnabled = useCallback((next: boolean) => {
    enabledRef.current = next
    setAudioEnabled(next)
    try { window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0") } catch { /* ignore */ }
    if (next) tryPlayBgm()
    else {
      if (fadeInRef.current) { window.clearInterval(fadeInRef.current); fadeInRef.current = null }
      bgmRef.current?.pause()
    }
  }, [tryPlayBgm])

  const enableAudio = useCallback(() => setEnabled(true), [setEnabled])
  const toggleAudio = useCallback(() => setEnabled(!enabledRef.current), [setEnabled])

  // Stop everything if the provider ever unmounts.
  useEffect(() => () => { bgmRef.current?.pause() }, [])

  const value = useMemo(
    () => ({ isAudioEnabled, enableAudio, toggleAudio, startLobbyMusic, stopLobbyMusic, playSound }),
    [isAudioEnabled, enableAudio, toggleAudio, startLobbyMusic, stopLobbyMusic, playSound],
  )

  return (
    <GameAudioContext.Provider value={value}>
      {children}
      {pathname?.startsWith("/room") && <div className="fixed bottom-4 right-4 z-50"><AudioToggle /></div>}
    </GameAudioContext.Provider>
  )
}

export function useGameAudio() {
  const context = useContext(GameAudioContext)
  if (!context) throw new Error("useGameAudio must be used inside GameAudioProvider")
  return context
}

export function AudioToggle() {
  const { isAudioEnabled, toggleAudio } = useGameAudio()
  const label = isAudioEnabled ? "Mute game audio" : "Enable game audio"
  return (
    <button
      type="button"
      onClick={toggleAudio}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-[#0b1018]/90 px-3 text-xs font-semibold text-white/65 shadow-lg backdrop-blur transition hover:border-[#10d7ac]/30 hover:bg-[#10d7ac]/[0.08] hover:text-white"
      aria-label={label}
      title={label}
    >
      {isAudioEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
      {isAudioEnabled ? "Sound on" : "Sound off"}
    </button>
  )
}
