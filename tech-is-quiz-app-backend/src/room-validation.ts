const nicknamePattern = /^[\p{L}\p{N} _-]+$/u

export function normalizeNickname(value: string): string {
  const normalized = value
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return normalized.slice(0, 24)
}

export function validateNickname(value: string): string | null {
  const normalized = value.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").trim()
  if (!normalized) return "Enter a nickname to join."
  if (normalized.length > 24) return "Keep your nickname to 24 characters or fewer."
  const formatted = normalizeNickname(value)
  if (!nicknamePattern.test(formatted)) return "Use letters, numbers, spaces, underscores, or hyphens."
  return null
}

export function validateTeamName(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 28)
}

export function validateTeamNameInput(value: string): string | null {
  const normalized = validateTeamName(value)
  if (!normalized) return "Choose or create a team name."
  return null
}
