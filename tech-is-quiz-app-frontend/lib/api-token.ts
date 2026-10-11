let cachedToken: Promise<string> | null = null

/** Fetches (once) the session token used to authenticate API and socket requests. */
export function getApiToken(): Promise<string> {
  cachedToken ??= fetch("/api/auth/token", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Not signed in.")
      return ((await response.json()) as { token: string }).token
    })
    .catch((error) => {
      cachedToken = null
      throw error
    })
  return cachedToken
}

export function clearApiToken() {
  cachedToken = null
}
