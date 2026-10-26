/** WhatsApp allows at most 4,096 characters in one text message. */
export const TEXT_MAX = 4096;

/**
 * Cuts a long message into parts that each fit in one WhatsApp text. Cuts between paragraphs
 * where it can, then between lines, and mid-line only for a single line longer than the limit.
 */
export function splitMessage(text: string, max: number = TEXT_MAX): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let current = "";
  const push = (piece: string, sep: string) => {
    if (!current) current = piece;
    else if (current.length + sep.length + piece.length <= max) current += sep + piece;
    else {
      parts.push(current);
      current = piece;
    }
  };
  for (const para of text.split("\n\n")) {
    if (para.length <= max) {
      push(para, "\n\n");
      continue;
    }
    for (const line of para.split("\n")) {
      if (line.length <= max) {
        push(line, "\n");
        continue;
      }
      for (let i = 0; i < line.length; i += max) push(line.slice(i, i + max), "");
    }
  }
  if (current) parts.push(current);
  return parts;
}
