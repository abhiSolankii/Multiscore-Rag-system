/**
 * Parse [[Chunk N]] citation tokens in LLM response text.
 * Returns an array of segments: { type: 'text'|'citation', content, index }
 *
 * @param {string} content - Raw LLM response content
 * @param {Array}  usedChunks - Array of chunk objects from backend
 * @returns {Array} segments
 */
export const parseCitations = (content, usedChunks = []) => {
  if (!content) return [];

  const regex = /\[\[Chunk (\d+)\]\]/gi;
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // Text before this citation
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }

    const chunkNumber = parseInt(match[1], 10); // 1-based
    const chunk = usedChunks[chunkNumber - 1] || null;

    segments.push({
      type: 'citation',
      index: chunkNumber,
      chunk,
    });

    lastIndex = regex.lastIndex;
  }

  // Remaining text after last citation
  if (lastIndex < content.length) {
    segments.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return segments;
};

/**
 * Strip [[Chunk N]] tokens from content (for plain text display).
 */
export const stripCitations = (content) =>
  content?.replace(/\[\[Chunk \d+\]\]/gi, '').trim() ?? '';
