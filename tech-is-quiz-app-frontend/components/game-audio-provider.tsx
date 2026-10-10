"use client"

import useSound from "use-sound"
import { Volume2, VolumeX } from "lucide-react"
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

export type GameSound = "tick" | "pop" | "correct" | "wrong" | "chime"

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
  const [isAudioEnabled, setAudioEnabled] = useState(false)
  const [playLobby, { stop: stopLobby }] = useSound("/sounds/lobby-bgm.mp3", { loop: true, volume: 0.5 })
  const [playTick] = useSound("/sounds/tick.mp3", { volume: 0.45 })
  const [playPop] = useSound("/sounds/pop.mp3", { volume: 0.35 })
  const [playCorrect] = useSound("/sounds/correct.mp3", { volume: 0.65 })
  const [playWrong] = useSound("/sounds/wrong.mp3", { volume: 0.55 })
  const [playChime] = useSound("/sounds/chime.mp3", { volume: 0.5 })

  useEffect(() => {
    if (!isAudioEnabled) stopLobby()
  }, [isAudioEnabled, stopLobby])

  const enableAudio = useCallback(() => setAudioEnabled(true), [])
  const toggleAudio = useCallback(() => setAudioEnabled((enabled) => !enabled), [])
  const startLobbyMusic = useCallback(() => { if (isAudioEnabled) playLobby() }, [isAudioEnabled, playLobby])
  const stopLobbyMusic = useCallback(() => stopLobby(), [stopLobby])
  const playSound = useCallback((sound: GameSound) => {
    if (!isAudioEnabled) return
    if (sound === "tick") playTick()
    if (sound === "pop") playPop()
    if (sound === "correct") playCorrect()
    if (sound === "wrong") playWrong()
    if (sound === "chime") playChime()
  }, [isAudioEnabled, playChime, playCorrect, playPop, playTick, playWrong])

  const value = useMemo(() => ({ isAudioEnabled, enableAudio, toggleAudio, startLobbyMusic, stopLobbyMusic, playSound }), [enableAudio, isAudioEnabled, playSound, startLobbyMusic, stopLobbyMusic, toggleAudio])
  return <GameAudioContext.Provider value={value}>{children}</GameAudioContext.Provider>
}

export function useGameAudio() {
  const context = useContext(GameAudioContext)
  if (!context) throw new Error("useGameAudio must be used inside GameAudioProvider")
  return context
}

export function AudioToggle() {
  const { isAudioEnabled, toggleAudio, enableAudio } = useGameAudio()
  return <button type="button" onClick={() => { enableAudio(); toggleAudio() }} className="inline-flex size-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-white/55 transition hover:border-[#10d7ac]/30 hover:bg-[#10d7ac]/[0.08] hover:text-white" aria-label={isAudioEnabled ? "Mute game audio" : "Enable game audio"} title={isAudioEnabled ? "Mute game audio" : "Enable game audio"}>{isAudioEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}</button>
}
