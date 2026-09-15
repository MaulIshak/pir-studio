/**
 * Generates a clean URL slug from a string.
 * Lowercases, strips diacritics/accents, converts non-alphanumeric chars to hyphens,
 * and trims leading/trailing hyphens.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
