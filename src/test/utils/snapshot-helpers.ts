/**
 * Utilities for TUI snapshot testing
 * Provides normalization functions to create stable, deterministic snapshots
 */

/**
 * ANSI escape code pattern for stripping
 */
const ANSI_REGEX =
  /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

/**
 * Strip all ANSI escape codes from a string
 */
export function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, "");
}

/**
 * Normalize whitespace for snapshot comparison
 * - Trims trailing whitespace from each line
 * - Normalizes multiple blank lines to single blank lines
 * - Removes trailing newlines
 */
export function normalizeWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Options for snapshot normalization
 */
export interface SnapshotOptions {
  /** Strip ANSI escape codes (default: true) */
  stripAnsi?: boolean;
  /** Normalize whitespace (default: true) */
  normalizeWhitespace?: boolean;
  /** Remove cursor position artifacts (default: true) */
  removeCursor?: boolean;
  /** Remove timestamps or dynamic content patterns */
  dynamicPatterns?: RegExp[];
}

const DEFAULT_OPTIONS: SnapshotOptions = {
  stripAnsi: true,
  normalizeWhitespace: true,
  removeCursor: true,
};

/**
 * Normalize TUI output for snapshot comparison
 * Removes ANSI codes, normalizes whitespace, and handles cursor artifacts
 */
export function normalizeSnapshot(
  text: string,
  options: SnapshotOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let result = text;

  // Strip ANSI codes first
  if (opts.stripAnsi) {
    result = stripAnsi(result);
  }

  // Remove cursor position indicator (inverse space character)
  if (opts.removeCursor) {
    result = result.replace(/\u001b\[7m \u001b\[27m/g, "_");
    // Also remove any remaining inverse video sequences
    result = result.replace(/[\u001b]\[7m.[\u001b]\[27m/g, "_");
  }

  // Apply custom dynamic patterns
  if (opts.dynamicPatterns) {
    for (const pattern of opts.dynamicPatterns) {
      result = result.replace(pattern, "[DYNAMIC]");
    }
  }

  // Normalize whitespace
  if (opts.normalizeWhitespace) {
    result = normalizeWhitespace(result);
  }

  return result;
}

/**
 * Extract relevant sections from TUI output for focused snapshot testing
 * Useful for testing specific UI components within a larger prompt
 */
export function extractSection(
  text: string,
  startPattern: RegExp | string,
  endPattern?: RegExp | string
): string | null {
  const lines = text.split("\n");
  let capturing = false;
  const captured: string[] = [];

  for (const line of lines) {
    const matchesStart =
      typeof startPattern === "string"
        ? line.includes(startPattern)
        : startPattern.test(line);

    const matchesEnd = endPattern
      ? typeof endPattern === "string"
        ? line.includes(endPattern)
        : endPattern.test(line)
      : false;

    if (matchesStart && !capturing) {
      capturing = true;
    }

    if (capturing) {
      captured.push(line);

      if (matchesEnd) {
        break;
      }
    }
  }

  return captured.length > 0 ? captured.join("\n") : null;
}

/**
 * Compare two snapshots and return differences
 * Useful for debugging snapshot failures
 */
export function diffSnapshots(
  expected: string,
  actual: string
): { hasDiff: boolean; diff: string } {
  const expectedLines = expected.split("\n");
  const actualLines = actual.split("\n");
  const diffLines: string[] = [];
  let hasDiff = false;

  const maxLines = Math.max(expectedLines.length, actualLines.length);

  for (let i = 0; i < maxLines; i++) {
    const expectedLine = expectedLines[i] ?? "";
    const actualLine = actualLines[i] ?? "";

    if (expectedLine !== actualLine) {
      hasDiff = true;
      diffLines.push(`Line ${i + 1}:`);
      diffLines.push(`  - ${JSON.stringify(expectedLine)}`);
      diffLines.push(`  + ${JSON.stringify(actualLine)}`);
    }
  }

  return { hasDiff, diff: diffLines.join("\n") };
}

/**
 * Create a snapshot assertion helper
 * Returns a function that normalizes and compares snapshots
 */
export function createSnapshotMatcher(options: SnapshotOptions = {}) {
  return (actual: string, expected: string): boolean => {
    const normalizedActual = normalizeSnapshot(actual, options);
    const normalizedExpected = normalizeSnapshot(expected, options);
    return normalizedActual === normalizedExpected;
  };
}

/**
 * Format a snapshot for readable output
 * Adds line numbers and visual markers
 */
export function formatSnapshot(text: string): string {
  const lines = text.split("\n");
  const maxLineNum = String(lines.length).length;

  return lines
    .map((line, i) => {
      const lineNum = String(i + 1).padStart(maxLineNum, " ");
      return `${lineNum} | ${line}`;
    })
    .join("\n");
}
