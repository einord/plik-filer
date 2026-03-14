export function usePasswordStrength() {
  function checkStrength(password: string): { score: number; level: 'weak' | 'fair' | 'good' | 'strong' } {
    let score = 0

    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (password.length >= 16) score++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[^a-zA-Z0-9]/.test(password)) score++
    if (/^[a-zA-Z]+$/.test(password)) score = Math.max(0, score - 1)
    if (/^[0-9]+$/.test(password)) score = 0

    if (score <= 2) return { score, level: 'weak' }
    if (score <= 3) return { score, level: 'fair' }
    if (score <= 4) return { score, level: 'good' }
    return { score, level: 'strong' }
  }

  function generatePassword(length = 20): string {
    const lowercase = 'abcdefghijkmnopqrstuvwxyz'
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const numbers = '23456789'
    const symbols = '!@#$%&*+-='
    const allChars = lowercase + uppercase + numbers + symbols

    const array = new Uint32Array(length)
    crypto.getRandomValues(array)

    let password = ''
    password += lowercase[array[0] % lowercase.length]
    password += uppercase[array[1] % uppercase.length]
    password += numbers[array[2] % numbers.length]
    password += symbols[array[3] % symbols.length]

    for (let i = password.length; i < length; i++) {
      password += allChars[array[i] % allChars.length]
    }

    // Shuffle using remaining random values
    const chars = password.split('')
    for (let i = chars.length - 1; i > 0; i--) {
      const j = array[i % array.length] % (i + 1)
      ;[chars[i], chars[j]] = [chars[j], chars[i]]
    }

    return chars.join('')
  }

  return { checkStrength, generatePassword }
}
