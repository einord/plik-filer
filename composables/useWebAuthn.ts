// Global WebAuthn state to ensure only one credential operation runs at a time.
// Safari crashes if multiple requests are pending simultaneously.

let activeController: AbortController | null = null

function abortPending() {
  if (activeController) {
    try { activeController.abort() } catch { /* ignore */ }
    activeController = null
  }
}

export function useWebAuthn() {

  async function createCredential(publicKey: PublicKeyCredentialCreationOptions): Promise<PublicKeyCredential | null> {
    abortPending()

    // Small delay to let Safari clean up any previous request
    await new Promise((r) => setTimeout(r, 100))

    activeController = new AbortController()

    try {
      const credential = await navigator.credentials.create({
        publicKey,
        signal: activeController.signal,
      }) as PublicKeyCredential | null
      return credential
    } finally {
      activeController = null
    }
  }

  async function getCredential(publicKey: PublicKeyCredentialRequestOptions): Promise<PublicKeyCredential | null> {
    abortPending()

    // Small delay to let Safari clean up any previous request
    await new Promise((r) => setTimeout(r, 100))

    activeController = new AbortController()

    try {
      const credential = await navigator.credentials.get({
        publicKey,
        signal: activeController.signal,
      }) as PublicKeyCredential | null
      return credential
    } finally {
      activeController = null
    }
  }

  function abort() {
    abortPending()
  }

  return { createCredential, getCredential, abort }
}
