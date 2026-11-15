/**
 * Zero-Knowledge Vault Cryptographic Service for DeskNest
 * Implements SEC-01 & SEC-03: AES-256-GCM encryption with PBKDF2-SHA512 key derivation.
 * Conforms to Web Crypto API (crypto.subtle) standards in both webview and Node environments.
 */

export interface EncryptedEnvelope {
  __encrypted: true;
  v: 1;
  kdf: "PBKDF2-SHA512";
  iterations: 600000;
  salt: string;       // Base64 32-byte salt
  iv: string;         // Base64 12-byte IV
  ciphertext: string; // Base64 AES-256-GCM ciphertext (includes 16-byte auth tag)
}

const DEFAULT_ITERATIONS = 600000;
const SALT_BYTE_LENGTH = 32;
const IV_BYTE_LENGTH = 12;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Robust chunked conversion from Uint8Array to Base64.
 * Avoids call-stack overflow on large payloads (e.g. voice memos or full backups).
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // 32KB chunking
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunkSize, len)) as unknown as number[]
    );
  }
  return btoa(binary);
}

/**
 * Converts a Base64 string back to Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Type guard to check if an unknown value is a valid EncryptedEnvelope.
 */
export function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).__encrypted === true &&
    (value as Record<string, unknown>).v === 1 &&
    (value as Record<string, unknown>).kdf === "PBKDF2-SHA512" &&
    typeof (value as Record<string, unknown>).salt === "string" &&
    typeof (value as Record<string, unknown>).iv === "string" &&
    typeof (value as Record<string, unknown>).ciphertext === "string" &&
    typeof (value as Record<string, unknown>).iterations === "number"
  );
}

/**
 * Derives a 256-bit AES-GCM CryptoKey from a passphrase using PBKDF2-SHA512.
 */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = DEFAULT_ITERATIONS
): Promise<CryptoKey> {
  const passBytes = textEncoder.encode(passphrase);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    passBytes,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-512",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts arbitrary serializable data using AES-256-GCM.
 * Accepts either a plaintext passphrase (which derives a new key with fresh salt)
 * or an existing CryptoKey.
 */
export async function encryptData<T>(
  data: T,
  passphraseOrKey: string | CryptoKey,
  existingSalt?: Uint8Array,
  iterations: number = DEFAULT_ITERATIONS
): Promise<EncryptedEnvelope> {
  let key: CryptoKey;
  let saltBytes: Uint8Array;

  if (typeof passphraseOrKey === "string") {
    saltBytes = existingSalt ?? crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));
    key = await deriveKey(passphraseOrKey, saltBytes, iterations);
  } else {
    key = passphraseOrKey;
    saltBytes = existingSalt ?? crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));
  }

  // 12-byte initialization vector unique to every encryption operation
  const ivBytes = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
  const serialized = JSON.stringify(data);
  const encodedData = textEncoder.encode(serialized);

  const ciphertextBuf = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: ivBytes,
    },
    key,
    encodedData
  );

  return {
    __encrypted: true,
    v: 1,
    kdf: "PBKDF2-SHA512",
    iterations: iterations as 600000,
    salt: uint8ArrayToBase64(saltBytes),
    iv: uint8ArrayToBase64(ivBytes),
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertextBuf)),
  };
}

/**
 * Decrypts an EncryptedEnvelope back into its original typed object.
 * Throws an error if the passphrase is incorrect or if the ciphertext has been tampered with.
 */
export async function decryptData<T = unknown>(
  envelope: EncryptedEnvelope,
  passphraseOrKey: string | CryptoKey
): Promise<T> {
  if (!isEncryptedEnvelope(envelope)) {
    throw new Error("Invalid encrypted envelope: payload does not match EncryptedEnvelope specification");
  }

  const saltBytes = base64ToUint8Array(envelope.salt);
  const ivBytes = base64ToUint8Array(envelope.iv);
  const ciphertextBytes = base64ToUint8Array(envelope.ciphertext);

  let key: CryptoKey;
  if (typeof passphraseOrKey === "string") {
    const iter = envelope.iterations || DEFAULT_ITERATIONS;
    key = await deriveKey(passphraseOrKey, saltBytes, iter);
  } else {
    key = passphraseOrKey;
  }

  try {
    const decryptedBuf = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBytes,
      },
      key,
      ciphertextBytes
    );

    const decodedText = textDecoder.decode(decryptedBuf);
    return JSON.parse(decodedText) as T;
  } catch {
    throw new Error("Decryption failed: Incorrect passphrase or corrupted ciphertext");
  }
}

/**
 * Generates a verification digest for a passphrase so the UI can check
 * validity without storing the plaintext passphrase.
 */
export async function hashPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = DEFAULT_ITERATIONS
): Promise<string> {
  const key = await deriveKey(passphrase, salt, iterations);
  const rawExport = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: new Uint8Array(12) },
    key,
    textEncoder.encode("desknest_vault_verifier")
  );
  return uint8ArrayToBase64(new Uint8Array(rawExport));
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Vault Session Manager
// ─────────────────────────────────────────────────────────────────────────────

type VaultListener = (unlocked: boolean) => void;

class VaultSessionManager {
  private activeKey: CryptoKey | null = null;
  private activeSalt: Uint8Array | null = null;
  private autoLockMinutes = 15;
  private autoLockTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<VaultListener> = new Set();

  /**
   * Returns true if the vault is currently unlocked and holding an active cryptographic key.
   */
  public isUnlocked(): boolean {
    return this.activeKey !== null;
  }

  /**
   * Returns the active AES-GCM CryptoKey from volatile memory, or null if locked.
   */
  public getActiveKey(): CryptoKey | null {
    return this.activeKey;
  }

  /**
   * Unlocks the vault with the user's master passphrase, deriving an AES-GCM key.
   */
  public async unlock(
    passphrase: string,
    iterations: number = DEFAULT_ITERATIONS,
    existingSalt?: Uint8Array
  ): Promise<void> {
    const salt = existingSalt ?? crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));
    this.activeKey = await deriveKey(passphrase, salt, iterations);
    this.activeSalt = salt;
    this.resetActivityTimer();
    this.notifyListeners();
  }

  /**
   * Locks the vault immediately, scrubbing the active key from memory.
   */
  public lock(): void {
    this.activeKey = null;
    this.activeSalt = null;
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
    this.notifyListeners();
  }

  /**
   * Sets auto-lock inactivity duration in minutes (0 disables auto-lock).
   */
  public setAutoLockMinutes(minutes: number): void {
    this.autoLockMinutes = Math.max(0, minutes);
    this.resetActivityTimer();
  }

  /**
   * Resets the auto-lock countdown timer on user interaction.
   */
  public resetActivityTimer(): void {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }

    if (this.activeKey && this.autoLockMinutes > 0) {
      this.autoLockTimer = setTimeout(() => {
        this.lock();
      }, this.autoLockMinutes * 60 * 1000);
    }
  }

  /**
   * Subscribes to lock/unlock state changes.
   */
  public subscribe(listener: VaultListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Encrypts data using the currently active vault key.
   * Throws an error if the vault is locked.
   */
  public async encryptWithVault<T>(
    data: T,
    iterations: number = DEFAULT_ITERATIONS
  ): Promise<EncryptedEnvelope> {
    if (!this.activeKey) {
      throw new Error("Cannot encrypt: DeskNest vault is currently locked");
    }
    this.resetActivityTimer();
    return encryptData(data, this.activeKey, this.activeSalt ?? undefined, iterations);
  }

  /**
   * Decrypts an envelope using the currently active vault key.
   * Throws an error if the vault is locked.
   */
  public async decryptWithVault<T>(envelope: EncryptedEnvelope): Promise<T> {
    if (!this.activeKey) {
      throw new Error("Cannot decrypt: DeskNest vault is currently locked");
    }
    this.resetActivityTimer();
    return decryptData<T>(envelope, this.activeKey);
  }

  private notifyListeners(): void {
    const unlocked = this.isUnlocked();
    for (const listener of this.listeners) {
      try {
        listener(unlocked);
      } catch {
        // Safe isolation
      }
    }
  }
}

export const vaultCryptoService = new VaultSessionManager();
