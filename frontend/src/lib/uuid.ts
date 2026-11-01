/**
 * UUID v7 (RFC 9562): 48-bit ms timestamp from `at`, version 7, variant 10, random rest.
 * Used for client-generated task and note IDs (TK §7).
 */
export function uuidv7(at: Date): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  const ms = at.getTime();
  // 48-bit big-endian millisecond timestamp
  bytes[0] = Math.floor(ms / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(ms / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(ms / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(ms / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(ms / 2 ** 8) & 0xff;
  bytes[5] = ms & 0xff;

  // Version 7: 0b0111_xxxx
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  // Variant 10 (RFC 4122/9562): 0b10xx_xxxx
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
