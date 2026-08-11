/**
 * Normalize raw file text to the editor's internal representation: LF line
 * endings, no BOM (the BOM is handled separately at read time). CodeMirror
 * normalizes line endings on load anyway; doing it explicitly keeps
 * dirty-tracking comparisons exact. Shared by main and renderer.
 */
export function toEditorText(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
