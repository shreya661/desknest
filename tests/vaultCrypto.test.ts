import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  encryptData,
  decryptData,
  deriveKey,
  isEncryptedEnvelope,
  uint8ArrayToBase64,
  base64ToUint8Array,
  hashPassphrase,
  vaultCryptoService,
  EncryptedEnvelope,
} from "../src/services/vaultCryptoService";
import { backupRepository } from "../src/repositories/backupRepository";
import { notesRepository } from "../src/repositories/notesRepository";
import { tasksRepository } from "../src/repositories/tasksRepository";

describe("Zero-Knowledge Vault Cryptographic Engine (SEC-01 & SEC-03)", () => {
  const TEST_PASSPHRASE = "DeskNest-Secure-Passphrase!2026";
  const FAST_ITERATIONS = 5000; // Fast for unit testing; production default is 600,000

  beforeEach(async () => {
    vaultCryptoService.lock();
    await notesRepository.clear();
    await tasksRepository.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Base64 & ArrayBuffer Utilities", () => {
    it("encodes and decodes small and large byte arrays cleanly", () => {
      const original = new Uint8Array([0, 1, 2, 255, 128, 64, 32]);
      const base64 = uint8ArrayToBase64(original);
      const decoded = base64ToUint8Array(base64);

      expect(decoded).toEqual(original);
    });

    it("handles large byte arrays without maximum call stack errors", () => {
      // 100KB buffer simulating an audio memo or vector drawing
      const large = new Uint8Array(100 * 1024);
      for (let i = 0; i < large.length; i++) {
        large[i] = i % 256;
      }

      const base64 = uint8ArrayToBase64(large);
      const restored = base64ToUint8Array(base64);
      expect(restored.length).toBe(large.length);
      expect(restored[500]).toBe(500 % 256);
    });
  });

  describe("Envelope Structure & Type Guards", () => {
    it("recognizes valid encrypted envelopes", async () => {
      const sample = { secret: "DeskNest Confidential" };
      const envelope = await encryptData(sample, TEST_PASSPHRASE, undefined, FAST_ITERATIONS);

      expect(isEncryptedEnvelope(envelope)).toBe(true);
      expect(envelope.__encrypted).toBe(true);
      expect(envelope.v).toBe(1);
      expect(envelope.kdf).toBe("PBKDF2-SHA512");
      expect(typeof envelope.salt).toBe("string");
      expect(typeof envelope.iv).toBe("string");
      expect(typeof envelope.ciphertext).toBe("string");
    });

    it("rejects invalid or malformed objects", () => {
      expect(isEncryptedEnvelope(null)).toBe(false);
      expect(isEncryptedEnvelope({})).toBe(false);
      expect(isEncryptedEnvelope({ __encrypted: true, v: 2 })).toBe(false);
      expect(
        isEncryptedEnvelope({
          __encrypted: true,
          v: 1,
          kdf: "PBKDF2-SHA512",
          salt: "abc",
          // missing iv and ciphertext
        })
      ).toBe(false);
    });
  });

  describe("AES-256-GCM Encryption & Decryption", () => {
    it("encrypts and decrypts complex nested data structures", async () => {
      const secretPayload = {
        id: "note_123",
        title: "Confidential Project Strategy",
        blocks: [
          { type: "text", content: "Top secret strategic goals." },
          { type: "kanban", columns: [{ id: "c1", title: "Todo", cards: [] }] },
        ],
        tags: ["finance", "confidential"],
        timestamp: 1710000000000,
      };

      const envelope = await encryptData(secretPayload, TEST_PASSPHRASE, undefined, FAST_ITERATIONS);
      const decrypted = await decryptData<typeof secretPayload>(envelope, TEST_PASSPHRASE);

      expect(decrypted).toEqual(secretPayload);
    });

    it("throws an error when decrypting with an incorrect passphrase", async () => {
      const envelope = await encryptData(
        { data: "Sensitive Notes" },
        TEST_PASSPHRASE,
        undefined,
        FAST_ITERATIONS
      );

      await expect(
        decryptData(envelope, "Wrong-Passphrase-Attempt")
      ).rejects.toThrow(/Decryption failed/i);
    });

    it("throws an error if ciphertext or tag has been tampered with", async () => {
      const envelope = await encryptData(
        { data: "Untampered Message" },
        TEST_PASSPHRASE,
        undefined,
        FAST_ITERATIONS
      );

      // Corrupt a byte in the Base64 ciphertext
      const bytes = base64ToUint8Array(envelope.ciphertext);
      bytes[bytes.length - 2] ^= 0xff; // Flip bits in auth tag / ciphertext
      const tamperedEnvelope: EncryptedEnvelope = {
        ...envelope,
        ciphertext: uint8ArrayToBase64(bytes),
      };

      await expect(
        decryptData(tamperedEnvelope, TEST_PASSPHRASE)
      ).rejects.toThrow(/Decryption failed/i);
    });

    it("supports reusing a pre-derived CryptoKey for high-throughput operations", async () => {
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const key = await deriveKey(TEST_PASSPHRASE, salt, FAST_ITERATIONS);

      const data1 = { index: 1, text: "First fast write" };
      const data2 = { index: 2, text: "Second fast write" };

      const env1 = await encryptData(data1, key, salt, FAST_ITERATIONS);
      const env2 = await encryptData(data2, key, salt, FAST_ITERATIONS);

      // Notice IVs must be unique even when using the same key
      expect(env1.iv).not.toEqual(env2.iv);

      const dec1 = await decryptData<typeof data1>(env1, key);
      const dec2 = await decryptData<typeof data2>(env2, key);

      expect(dec1).toEqual(data1);
      expect(dec2).toEqual(data2);
    });

    it("generates deterministic verification hash for passphrase checks", async () => {
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const hash1 = await hashPassphrase(TEST_PASSPHRASE, salt, FAST_ITERATIONS);
      const hash2 = await hashPassphrase(TEST_PASSPHRASE, salt, FAST_ITERATIONS);
      const hashOther = await hashPassphrase("OtherPassphrase", salt, FAST_ITERATIONS);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hashOther);
    });
  });

  describe("In-Memory Vault Session Manager", () => {
    it("manages unlock, active key, and lock lifecycle", async () => {
      expect(vaultCryptoService.isUnlocked()).toBe(false);
      expect(vaultCryptoService.getActiveKey()).toBeNull();

      await vaultCryptoService.unlock(TEST_PASSPHRASE, FAST_ITERATIONS);
      expect(vaultCryptoService.isUnlocked()).toBe(true);
      expect(vaultCryptoService.getActiveKey()).not.toBeNull();

      // Encrypt with active vault key
      const envelope = await vaultCryptoService.encryptWithVault({ user: "Alice" }, FAST_ITERATIONS);
      expect(isEncryptedEnvelope(envelope)).toBe(true);

      const decrypted = await vaultCryptoService.decryptWithVault<{ user: string }>(envelope);
      expect(decrypted.user).toBe("Alice");

      // Lock vault
      vaultCryptoService.lock();
      expect(vaultCryptoService.isUnlocked()).toBe(false);
      expect(vaultCryptoService.getActiveKey()).toBeNull();

      // Attempting to encrypt while locked throws
      await expect(
        vaultCryptoService.encryptWithVault({ user: "Bob" })
      ).rejects.toThrow(/DeskNest vault is currently locked/i);
    });

    it("notifies listeners on lock and unlock transitions", async () => {
      const states: boolean[] = [];
      const unsubscribe = vaultCryptoService.subscribe((unlocked) => {
        states.push(unlocked);
      });

      await vaultCryptoService.unlock(TEST_PASSPHRASE, FAST_ITERATIONS);
      vaultCryptoService.lock();
      unsubscribe();

      expect(states).toEqual([true, false]);
    });

    it("triggers auto-lock timer upon inactivity", async () => {
      vi.useFakeTimers();

      await vaultCryptoService.unlock(TEST_PASSPHRASE, FAST_ITERATIONS);
      vaultCryptoService.setAutoLockMinutes(5);
      expect(vaultCryptoService.isUnlocked()).toBe(true);

      // Fast-forward 4 minutes: still unlocked
      vi.advanceTimersByTime(4 * 60 * 1000);
      expect(vaultCryptoService.isUnlocked()).toBe(true);

      // Activity resets timer
      vaultCryptoService.resetActivityTimer();
      vi.advanceTimersByTime(4 * 60 * 1000);
      expect(vaultCryptoService.isUnlocked()).toBe(true);

      // Fast-forward another 2 minutes (total 6 minutes after reset): locked!
      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(vaultCryptoService.isUnlocked()).toBe(false);
    });
  });

  describe("Encrypted Backup & Restore Integration (SEC-03)", () => {
    it("exports, detects, and decrypts encrypted workspace backups", async () => {
      await notesRepository.create({ title: "Confidential Project Note", content: "Very secret details" });
      await tasksRepository.create({ title: "Audit security protocols" });

      const encryptedJson = await backupRepository.exportEncrypted(
        TEST_PASSPHRASE,
        FAST_ITERATIONS
      );

      // Check detection
      expect(backupRepository.isEncryptedBackup(encryptedJson)).toBe(true);
      expect(backupRepository.isEncryptedBackup('{"format":"desknest-backup"}')).toBe(false);

      // Validate without passphrase flags as encrypted
      const validateNoPass = backupRepository.validate(encryptedJson);
      expect(validateNoPass.valid).toBe(false);
      expect(validateNoPass.isEncrypted).toBe(true);
      expect(validateNoPass.errors[0]).toContain("encrypted");

      // ValidateAsync with correct passphrase succeeds
      const validateWithPass = await backupRepository.validateAsync(encryptedJson, TEST_PASSPHRASE);
      expect(validateWithPass.valid).toBe(true);
      expect(validateWithPass.counts.notes).toBe(1);
      expect(validateWithPass.counts.tasks).toBe(1);

      // ValidateAsync with wrong passphrase fails cleanly
      const validateWrongPass = await backupRepository.validateAsync(
        encryptedJson,
        "WrongPassword!"
      );
      expect(validateWrongPass.valid).toBe(false);
      expect(validateWrongPass.errors[0]).toContain("Decryption failed");
    });

    it("imports encrypted backups in overwrite mode successfully", async () => {
      await notesRepository.create({ title: "Old Note To Be Overwritten" });

      // Create backup data with 1 note
      const sampleBackup = {
        format: "desknest-backup" as const,
        version: 2 as const,
        exportedAt: new Date().toISOString(),
        notes: [
          {
            id: "enc_note_1",
            title: "Restored From Encrypted Backup",
            content: "Safe and decrypted content",
            color: "lavender" as const,
            isPinned: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        tasks: [],
        reminders: [],
        drawings: [],
        settings: {
          theme: "dark" as const,
          alwaysOnTop: false,
          compactMode: false,
          defaultWidth: 840,
          defaultHeight: 680,
          defaultNoteColor: "amber" as const,
          notificationSound: true,
          textSize: "normal" as const,
        },
        notifications: [],
        audioBlobs: [],
      };

      const envelope = await encryptData(sampleBackup, TEST_PASSPHRASE, undefined, FAST_ITERATIONS);
      const encryptedJson = JSON.stringify(envelope);

      await backupRepository.importEncrypted(encryptedJson, TEST_PASSPHRASE, "overwrite");

      const notes = await notesRepository.list();
      expect(notes.length).toBe(1);
      expect(notes[0].title).toBe("Restored From Encrypted Backup");
    });
  });
});

