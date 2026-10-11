export const REMOVED_NOTICE_KEY = "techis-removed-notice"

/** Called when the host removes this player: forget the saved session and return to the join screen. */
export function handleRemovedFromRoom(code: string) {
  try {
    window.localStorage.removeItem(`techis-participant:${code}`)
    window.sessionStorage.removeItem(`techis-player-name:${code}`)
    window.sessionStorage.removeItem(`techis-player-team:${code}`)
    window.sessionStorage.setItem(REMOVED_NOTICE_KEY, "The host removed you from the room.")
  } catch { /* storage unavailable */ }
  window.location.assign("/join")
}
