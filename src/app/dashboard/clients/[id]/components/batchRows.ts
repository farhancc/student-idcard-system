/**
 * Index bookkeeping for the Batch Import review grid.
 *
 * Rows there are identified by position, and two other structures hold those
 * positions: `imageOverrides` (keyed `${rowIdx}:${fieldName}`) and the list of
 * selected row indices. Removing a row shifts every index above it, so all three
 * have to move together — otherwise an uploaded photo silently re-attaches to
 * whoever shifted into that slot.
 */
export function remapAfterRowDelete(
  del: number,
  selectedRows: number[],
  imageOverrides: Record<string, string>
): { selectedRows: number[]; imageOverrides: Record<string, string> } {
  const nextSelected = selectedRows
    .filter(i => i !== del)
    .map(i => (i > del ? i - 1 : i));

  const nextOverrides: Record<string, string> = {};
  for (const [key, value] of Object.entries(imageOverrides)) {
    const sep = key.indexOf(':');
    if (sep < 0) continue;
    const idx = Number(key.slice(0, sep));
    const field = key.slice(sep + 1);
    // The deleted row's own uploads go with it rather than shifting onto a neighbour.
    if (!Number.isFinite(idx) || idx === del) continue;
    nextOverrides[`${idx > del ? idx - 1 : idx}:${field}`] = value;
  }

  return { selectedRows: nextSelected, imageOverrides: nextOverrides };
}
