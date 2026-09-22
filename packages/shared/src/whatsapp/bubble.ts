/**
 * Delimiter used to split a single Rara response into multiple WhatsApp message bubbles.
 * Matches '---' on its own line (with optional surrounding whitespace/newlines).
 */
export const BUBBLE_DELIMITER_REGEX = /(?:^|\r?\n)[\t ]*-{3,}[\t ]*(?:\r?\n|$)/;

/**
 * Splits a message string into individual bubbles using BUBBLE_DELIMITER_REGEX.
 * Filters out empty strings after splitting.
 */
export function splitBubbles(message: string): string[] {
  return message.split(BUBBLE_DELIMITER_REGEX).map((b) => b.trim()).filter(Boolean);
}

/**
 * Formats a Rara multi-bubble message ensuring the -r signature appears
 * only on the final bubble's last line.
 * Input bubbles are separated by \n---\n, output is unchanged except
 * the -r tag is removed from any non-final bubble and ensured on the last.
 */
export function formatRaraMessageWithSignature(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return message;

  // Split by bubble separator regex (matching apps/bot splitMessageBubbles logic)
  const separatorPattern = /(?:^|\r?\n|\\r?n)[ \t]*-{3,}[ \t]*(?:\r?\n|\\r?n|$)/;
  const parts = trimmed
    .split(separatorPattern)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^[- \t]+$/.test(p));

  if (parts.length <= 1) {
    const single = parts.length === 1 ? parts[0] : trimmed;
    // Strip any existing trailing -r (with optional leading newline and whitespace)
    const cleaned = single.replace(/(?:(?:\r?\n|\\r?n)[ \t]*)?-r[ \t]*$/i, '').trimEnd();
    return `${cleaned}\n\n-r`;
  }

  const cleanedBubbles = parts.map((bubble, index) => {
    const isLast = index === parts.length - 1;
    const cleaned = bubble.replace(/(?:(?:\r?\n|\\r?n)[ \t]*)?-r[ \t]*$/i, '').trimEnd();
    if (isLast) {
      return `${cleaned}\n\n-r`;
    }
    return cleaned;
  });

  return cleanedBubbles.join('\n---\n');
}
