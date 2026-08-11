import path from 'node:path';

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd']);

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Extract Markdown file paths from Electron's startup/second-instance argv.
 * Windows supplies the selected document as a command-line argument after the
 * executable path; filtering by extension also keeps development-only argv out.
 */
export function markdownFilePathsFromArguments(
  argv: readonly string[],
  workingDirectory: string,
): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();

  for (const rawArgument of argv) {
    const argument = unquote(rawArgument);
    if (!argument || argument.startsWith('--')) continue;
    if (!MARKDOWN_EXTENSIONS.has(path.extname(argument).toLocaleLowerCase())) continue;

    const absolutePath = path.isAbsolute(argument)
      ? path.normalize(argument)
      : path.resolve(workingDirectory, argument);
    const key = process.platform === 'win32' ? absolutePath.toLocaleLowerCase() : absolutePath;
    if (seen.has(key)) continue;
    seen.add(key);
    paths.push(absolutePath);
  }

  return paths;
}
