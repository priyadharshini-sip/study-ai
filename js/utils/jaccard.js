/**
 * jaccard.js — Jaccard Similarity Implementation
 * Used to: detect similar flashcards/questions, reduce repetition,
 * group related concepts, and power smart revision suggestions.
 */

const JaccardSimilarity = (() => {
  /**
   * Tokenizes text into a set of normalized words.
   * @param {string} text
   * @returns {Set<string>}
   */
  function tokenize(text) {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2) // remove short stop-word-like tokens
    );
  }

  /**
   * Computes Jaccard similarity between two strings.
   * J(A,B) = |A ∩ B| / |A ∪ B|
   * @param {string} textA
   * @param {string} textB
   * @returns {number} similarity in [0, 1]
   */
  function compute(textA, textB) {
    if (!textA || !textB) return 0;
    const setA = tokenize(textA);
    const setB = tokenize(textB);

    if (setA.size === 0 && setB.size === 0) return 1;
    if (setA.size === 0 || setB.size === 0) return 0;

    const intersection = new Set([...setA].filter(t => setB.has(t)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
  }

  /**
   * Find all similar items from a list compared to a query string.
   * @param {string} query — the text to compare against
   * @param {Array<{id: string, text: string}>} items — corpus
   * @param {number} threshold — minimum similarity (default 0.25)
   * @returns {Array<{item, similarity}>} sorted by similarity desc
   */
  function findSimilar(query, items, threshold = 0.25) {
    return items
      .map(item => ({ item, similarity: compute(query, item.text) }))
      .filter(r => r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Cluster an array of text items by similarity using greedy grouping.
   * @param {Array<{id: string, text: string}>} items
   * @param {number} threshold — grouping threshold (default 0.3)
   * @returns {Array<Array<{id, text}>>} array of clusters
   */
  function cluster(items, threshold = 0.3) {
    const visited = new Set();
    const clusters = [];

    for (let i = 0; i < items.length; i++) {
      if (visited.has(items[i].id)) continue;
      const group = [items[i]];
      visited.add(items[i].id);

      for (let j = i + 1; j < items.length; j++) {
        if (visited.has(items[j].id)) continue;
        if (compute(items[i].text, items[j].text) >= threshold) {
          group.push(items[j]);
          visited.add(items[j].id);
        }
      }
      clusters.push(group);
    }
    return clusters;
  }

  /**
   * Deduplicate an array of flashcard/question objects by removing items
   * that are too similar to already seen ones.
   * @param {Array<{id: string, question: string}>} items
   * @param {number} threshold — items above this are considered duplicates (default 0.6)
   * @returns {{ unique: Array, removed: Array }}
   */
  function deduplicate(items, threshold = 0.6) {
    const unique = [];
    const removed = [];

    for (const item of items) {
      const isDup = unique.some(
        u => compute(item.question, u.question) >= threshold
      );
      if (isDup) {
        removed.push(item);
      } else {
        unique.push(item);
      }
    }
    return { unique, removed };
  }

  /**
   * Smart revision suggestions: given recent wrong answers, suggest
   * related cards from the full deck.
   * @param {Array<string>} wrongTexts — questions the user got wrong
   * @param {Array<{id, question, topic}>} allCards
   * @param {number} topN — how many suggestions to return
   * @returns {Array} suggested cards
   */
  function getRevisionSuggestions(wrongTexts, allCards, topN = 5) {
    const scoreMap = new Map();

    for (const wrongText of wrongTexts) {
      for (const card of allCards) {
        const sim = compute(wrongText, card.question);
        const prev = scoreMap.get(card.id) || 0;
        scoreMap.set(card.id, Math.max(prev, sim));
      }
    }

    return allCards
      .filter(c => scoreMap.has(c.id) && scoreMap.get(c.id) > 0.15)
      .sort((a, b) => (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0))
      .slice(0, topN);
  }

  return { compute, tokenize, findSimilar, cluster, deduplicate, getRevisionSuggestions };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JaccardSimilarity;
}
