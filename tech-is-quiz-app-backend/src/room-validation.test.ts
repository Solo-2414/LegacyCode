import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { normalizeNickname, validateNickname, validateTeamName, validateTeamNameInput } from "./room-validation.ts"

describe("room join validation", () => {
  it("normalizes nickname spacing and removes invisible characters", () => {
    assert.equal(normalizeNickname("  Pixel  Pilot  "), "Pixel Pilot")
    assert.equal(normalizeNickname("\u200bPixel Pilot\u200b"), "Pixel Pilot")
  })

  it("rejects empty, invalid, and overlong nicknames", () => {
    assert.equal(validateNickname("   "), "Enter a nickname to join.")
    assert.equal(validateNickname("!pixel"), "Use letters, numbers, spaces, underscores, or hyphens.")
    assert.equal(validateNickname("A".repeat(25)), "Keep your nickname to 24 characters or fewer.")
  })

  it("validates friendly team names", () => {
    assert.equal(validateTeamName("  The Syntax Squad  "), "The Syntax Squad")
    assert.equal(validateTeamName("   "), "")
    assert.equal(validateTeamName("A".repeat(29)), "A".repeat(28))
    assert.equal(validateTeamNameInput("   "), "Choose or create a team name.")
  })
})
