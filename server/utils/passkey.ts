// In-memory challenge store with automatic TTL cleanup
const CHALLENGE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface ChallengeEntry {
  challenge: string
  expiresAt: number
}

const challengeStore = new Map<string, ChallengeEntry>()

/**
 * Store a WebAuthn challenge for later verification.
 */
export function storeChallenge(key: string, challenge: string): void {
  // Clean up expired entries on each write
  cleanupExpiredChallenges()
  challengeStore.set(key, {
    challenge,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  })
}

/**
 * Retrieve and remove a stored challenge. Returns null if not found or expired.
 */
export function getChallenge(key: string): string | null {
  const entry = challengeStore.get(key)
  if (!entry) return null

  // Remove after retrieval (single use)
  challengeStore.delete(key)

  if (Date.now() > entry.expiresAt) return null
  return entry.challenge
}

/**
 * Explicitly remove a stored challenge.
 */
export function removeChallenge(key: string): void {
  challengeStore.delete(key)
}

function cleanupExpiredChallenges(): void {
  const now = Date.now()
  for (const [key, entry] of challengeStore) {
    if (now > entry.expiresAt) {
      challengeStore.delete(key)
    }
  }
}
