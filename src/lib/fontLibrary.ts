// Shared helpers for the font pickers in Template Design and Serial Printer.
// Both custom press uploads and the bundled built-in library live in the same
// PressFont table (pressId: null = available to every press, matching the
// convention already used by /api/superadmin/fonts for global fonts).

export interface FontLibraryEntry {
  id: number;
  pressId: number | null;
  name: string;
  fileUrl: string;
}

// A weight/style variant of another font (e.g. "Lato Bold", "Lato Italic") is
// stored as its own PressFont row so pdf-lib can embed the exact matching
// file, but it isn't a selectable "font family" on its own — bold/italic are
// chosen via separate Font Weight / Font Style controls.
const VARIANT_SUFFIX = /\s+(Bold Italic|BoldItalic|Bold|Italic)$/i;

export function isFontVariantName(name: string): boolean {
  return VARIANT_SUFFIX.test(name);
}

// Splits the full font list (as returned by GET /api/fonts) into the two
// groups a picker should show, with weight/style variant rows collapsed out.
export function groupSelectableFonts<T extends FontLibraryEntry>(fonts: T[]): { builtin: T[]; custom: T[] } {
  const selectable = fonts.filter(f => !isFontVariantName(f.name));
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  return {
    builtin: selectable.filter(f => f.pressId === null).sort(byName),
    custom: selectable.filter(f => f.pressId !== null).sort(byName),
  };
}
