import { describe, it, expect, beforeEach } from 'vitest'
import {
  encryptBlob,
  decryptBlob,
  deriveBlobKey,
  BlobKeyUnavailableError,
  NONCE_LENGTH,
} from './blobCrypto.js'

// The module reaches the vault root key through an injectable provider
// (default: the intents key store). In tests we inject a provider that returns
// a root key shaped EXACTLY like the real one: a non-extractable HKDF base key
// whose only usage is ["deriveKey"] (see @glance-apps/intents deriveIntentsRootKey).
// This proves deriveBlobKey works against the genuine key shape, with no mocks.

let rootKey
let provideKey   // resolves to the (stable) root key
let provideNull  // resolves to null — simulates "key not available"

beforeEach(async () => {
  const rootBits = crypto.getRandomValues(new Uint8Array(32))
  rootKey = await crypto.subtle.importKey('raw', rootBits, 'HKDF', false, ['deriveKey'])
  provideKey = async () => rootKey
  provideNull = async () => null
})

// Fill a buffer with random bytes in <=64KB chunks (getRandomValues' per-call cap).
function randomBytes(n) {
  const out = new Uint8Array(n)
  for (let off = 0; off < n; off += 65536) {
    crypto.getRandomValues(out.subarray(off, Math.min(off + 65536, n)))
  }
  return out
}

async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const enc = (s) => new TextEncoder().encode(s)

describe('blobCrypto — determinism (a)', () => {
  it('encrypts the same plaintext to byte-identical ciphertext and hash', async () => {
    const pt = enc('the same bytes every time')
    const a = await encryptBlob(pt, provideKey)
    const b = await encryptBlob(pt, provideKey)

    expect([...a.bytes]).toEqual([...b.bytes]) // byte-identical stored form
    expect(a.hash).toBe(b.hash) // same content address → dedup / idempotent upload
  })

  it('is deterministic across distinct Uint8Array instances of equal content', async () => {
    const a = await encryptBlob(enc('hello'), provideKey)
    const b = await encryptBlob(new Uint8Array([104, 101, 108, 108, 111]), provideKey) // "hello"
    expect(a.hash).toBe(b.hash)
  })
})

describe('blobCrypto — distinct plaintexts (b)', () => {
  it('yields different nonces and different hashes (no collision)', async () => {
    const a = await encryptBlob(enc('hello world'), provideKey)
    const c = await encryptBlob(enc('goodbye moon'), provideKey)

    const nonceA = a.bytes.slice(0, NONCE_LENGTH)
    const nonceC = c.bytes.slice(0, NONCE_LENGTH)
    expect([...nonceA]).not.toEqual([...nonceC])
    expect(a.hash).not.toBe(c.hash)
  })

  it('a single-byte difference in plaintext changes the nonce and hash', async () => {
    const a = await encryptBlob(new Uint8Array([1, 2, 3, 4]), provideKey)
    const b = await encryptBlob(new Uint8Array([1, 2, 3, 5]), provideKey)
    expect([...a.bytes.slice(0, NONCE_LENGTH)]).not.toEqual([...b.bytes.slice(0, NONCE_LENGTH)])
    expect(a.hash).not.toBe(b.hash)
  })
})

describe('blobCrypto — round-trip (c)', () => {
  it('decrypt(encrypt(p)) === p for a small input', async () => {
    const pt = enc('round trip me 🛰️')
    const { bytes } = await encryptBlob(pt, provideKey)
    const out = await decryptBlob(bytes, provideKey)
    expect([...out]).toEqual([...pt])
  })

  it('decrypt(encrypt(p)) === p for an empty input', async () => {
    const pt = new Uint8Array(0)
    const { bytes } = await encryptBlob(pt, provideKey)
    const out = await decryptBlob(bytes, provideKey)
    expect(out.length).toBe(0)
  })

  it('decrypt(encrypt(p)) === p for a large (multi-MB) input', async () => {
    const pt = randomBytes(3 * 1024 * 1024) // 3 MB
    const { bytes } = await encryptBlob(pt, provideKey)
    const out = await decryptBlob(bytes, provideKey)
    expect(out.length).toBe(pt.length)
    // hash a cheap proof of full-buffer equality rather than a 3M-element toEqual
    expect(await sha256Hex(out)).toBe(await sha256Hex(pt))
  })

  it('accepts an ArrayBuffer as plaintext', async () => {
    const pt = enc('from an ArrayBuffer')
    const { bytes } = await encryptBlob(pt.buffer, provideKey)
    const out = await decryptBlob(bytes, provideKey)
    expect([...out]).toEqual([...pt])
  })
})

describe('blobCrypto — integrity (d)', () => {
  it('a tampered ciphertext byte makes decrypt fail (GCM tag)', async () => {
    const { bytes } = await encryptBlob(enc('authenticate me'), provideKey)
    const tampered = bytes.slice()
    tampered[tampered.length - 1] ^= 0x01 // flip a bit in the tag/ciphertext
    await expect(decryptBlob(tampered, provideKey)).rejects.toThrow()
  })

  it('a tampered nonce byte makes decrypt fail', async () => {
    const { bytes } = await encryptBlob(enc('authenticate me'), provideKey)
    const tampered = bytes.slice()
    tampered[0] ^= 0x01 // flip a bit in the nonce
    await expect(decryptBlob(tampered, provideKey)).rejects.toThrow()
  })

  it('truncated stored bytes are rejected', async () => {
    await expect(decryptBlob(new Uint8Array(5), provideKey)).rejects.toThrow()
  })
})

describe('blobCrypto — content address (e)', () => {
  it('hash equals SHA-256 of the exact stored bytes (matches server finalize)', async () => {
    const { bytes, hash } = await encryptBlob(enc('address me'), provideKey)
    expect(hash).toBe(await sha256Hex(bytes))
    expect(hash).toMatch(/^[0-9a-f]{64}$/) // 32-byte SHA-256, hex
  })

  it('stored bytes are [nonce(12) || ciphertext+tag(>=16)]', async () => {
    const pt = enc('layout')
    const { bytes } = await encryptBlob(pt, provideKey)
    // 12-byte nonce + plaintext length + 16-byte GCM tag
    expect(bytes.length).toBe(NONCE_LENGTH + pt.length + 16)
  })
})

describe('blobCrypto — key not available (f)', () => {
  it('encryptBlob throws BlobKeyUnavailableError, never produces output', async () => {
    await expect(encryptBlob(enc('secret'), provideNull)).rejects.toThrow(BlobKeyUnavailableError)
  })

  it('decryptBlob throws BlobKeyUnavailableError when key is absent', async () => {
    const { bytes } = await encryptBlob(enc('secret'), provideKey)
    await expect(decryptBlob(bytes, provideNull)).rejects.toThrow(BlobKeyUnavailableError)
  })

  it('deriveBlobKey returns null (not a throw) when key is absent', async () => {
    expect(await deriveBlobKey(provideNull)).toBeNull()
  })
})

describe('blobCrypto — key separation', () => {
  it('different root keys produce different ciphertext for the same plaintext', async () => {
    const otherBits = crypto.getRandomValues(new Uint8Array(32))
    const otherRoot = await crypto.subtle.importKey('raw', otherBits, 'HKDF', false, ['deriveKey'])
    const a = await encryptBlob(enc('same plaintext'), provideKey)
    const b = await encryptBlob(enc('same plaintext'), async () => otherRoot)
    expect(a.hash).not.toBe(b.hash) // key is secret, not content-derived
  })

  it('a blob encrypted under one key does not decrypt under another', async () => {
    const otherBits = crypto.getRandomValues(new Uint8Array(32))
    const otherRoot = await crypto.subtle.importKey('raw', otherBits, 'HKDF', false, ['deriveKey'])
    const { bytes } = await encryptBlob(enc('cross-key'), provideKey)
    await expect(decryptBlob(bytes, async () => otherRoot)).rejects.toThrow()
  })
})
