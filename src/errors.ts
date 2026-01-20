/**
 * Error handling utilities for skai CLI
 *
 * Consolidates error formatting and handling logic to ensure consistent
 * user-friendly error messages across the application.
 */

// Git error message patterns and their user-friendly descriptions
const GIT_ERROR_PATTERNS = [
  {
    patterns: ["authentication", "401", "403"],
    message: (url: string) =>
      `Authentication failed for ${url}. Check your credentials or ensure the repository is public.`,
  },
  {
    patterns: ["not found", "404", "does not exist"],
    message: (url: string) =>
      `Repository not found: ${url}. Check the URL or owner/repo name.`,
  },
  {
    patterns: ["timeout", "timed out"],
    message: (url: string) =>
      `Connection timed out while cloning ${url}. Check your network connection.`,
  },
  {
    patterns: ["could not resolve host", "network"],
    message: (url: string) =>
      `Network error while cloning ${url}. Check your internet connection.`,
  },
  {
    patterns: ["permission denied"],
    message: (url: string) =>
      `Permission denied when accessing ${url}. The repository may be private.`,
  },
] as const;

/**
 * Format a git error into a user-friendly message
 */
export function formatGitError(error: Error, url: string): string {
  const msg = error.message.toLowerCase();

  for (const { patterns, message } of GIT_ERROR_PATTERNS) {
    if (patterns.some((pattern) => msg.includes(pattern))) {
      return message(url);
    }
  }

  return `Failed to clone repository: ${error.message}`;
}

/**
 * Type guard to check if a value is a cancellation symbol
 */
export function isCancellation<T>(
  value: T | symbol
): value is symbol {
  return typeof value === "symbol";
}

/**
 * Handle potential cancellation and return the value or null
 * Useful for prompt results that may be cancelled
 */
export function handleCancellation<T>(
  value: T | symbol
): T | null {
  if (isCancellation(value)) {
    return null;
  }
  return value;
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
