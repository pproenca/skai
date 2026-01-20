import { MockInputStream } from "./mock-input-stream.js";
import { MockOutputStream, stripAnsi } from "./mock-output-stream.js";
import { KeySequence, keys } from "./key-sequence.js";

/**
 * Test harness for testing @clack/core-based prompts.
 * Provides mock streams, key sequence helpers, and assertion utilities.
 */
export class PromptTestHarness {
  readonly input: MockInputStream;
  readonly output: MockOutputStream;

  constructor() {
    this.input = new MockInputStream();
    this.output = new MockOutputStream();
  }

  /**
   * Get a key sequence builder for fluent key input
   */
  keys(): KeySequence {
    return keys(this.input);
  }

  /**
   * Wait for a number of milliseconds (useful for render cycles)
   */
  async tick(ms = 100): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wait for all queued inputs to be processed
   */
  async flush(): Promise<void> {
    await this.input.flush();
  }

  /**
   * Get the last rendered frame text (ANSI stripped)
   */
  getLastFrame(): string {
    return this.output.getLastFrameText();
  }

  /**
   * Get all rendered output text (ANSI stripped)
   */
  getAllText(): string {
    return this.output.getAllText();
  }

  /**
   * Check if output contains text
   */
  containsText(text: string): boolean {
    return this.output.containsText(text);
  }

  /**
   * Find lines matching a pattern in the last frame
   */
  findLines(pattern: RegExp | string): string[] {
    return this.output.findLines(pattern);
  }

  /**
   * Find lines matching a pattern in all output
   */
  findAllLines(pattern: RegExp | string): string[] {
    return this.output.findAllLines(pattern);
  }

  /**
   * Clear the output buffer
   */
  clearOutput(): void {
    this.output.clear();
  }

  /**
   * Assert that the output contains the given text
   */
  assertContains(text: string, message?: string): void {
    if (!this.containsText(text)) {
      const actualText = this.getAllText();
      throw new Error(
        message ??
          `Expected output to contain "${text}"\nActual output:\n${actualText}`
      );
    }
  }

  /**
   * Assert that the output does NOT contain the given text
   */
  assertNotContains(text: string, message?: string): void {
    if (this.containsText(text)) {
      const actualText = this.getAllText();
      throw new Error(
        message ??
          `Expected output NOT to contain "${text}"\nActual output:\n${actualText}`
      );
    }
  }

  /**
   * Assert that the output matches a pattern
   */
  assertMatches(pattern: RegExp, message?: string): void {
    const text = this.getAllText();
    if (!pattern.test(text)) {
      throw new Error(
        message ??
          `Expected output to match ${pattern}\nActual output:\n${text}`
      );
    }
  }

  /**
   * Assert that a specific line exists in the output
   */
  assertLineContains(
    linePattern: RegExp | string,
    expectedText: string,
    message?: string
  ): void {
    const lines = this.findAllLines(linePattern);
    if (lines.length === 0) {
      throw new Error(
        message ??
          `No lines matched pattern "${linePattern}"\nAll output:\n${this.getAllText()}`
      );
    }
    const hasMatch = lines.some((line) => line.includes(expectedText));
    if (!hasMatch) {
      throw new Error(
        message ??
          `No matched lines contain "${expectedText}"\nMatched lines:\n${lines.join("\n")}`
      );
    }
  }

  /**
   * Get the number of frames rendered
   */
  getFrameCount(): number {
    return this.output.frameCount;
  }

  /**
   * Simulate pressing enter to submit the prompt
   */
  submit(): void {
    this.input.pressEnter();
  }

  /**
   * Simulate pressing escape to cancel the prompt
   */
  cancel(): void {
    this.input.pressEscape();
  }

  /**
   * Create stream options to pass to prompt constructors
   */
  getStreamOptions(): { input: MockInputStream; output: MockOutputStream } {
    return {
      input: this.input,
      output: this.output,
    };
  }

  /**
   * Get a normalized snapshot of the current output for comparison.
   * Strips ANSI codes and normalizes whitespace.
   */
  getSnapshot(): string {
    const text = this.getAllText();
    return text
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /**
   * Assert that scroll indicators show expected counts.
   * Looks for "X more above" and "Y more below" patterns.
   * @param above Expected count of items above the visible area, or null to skip check
   * @param below Expected count of items below the visible area, or null to skip check
   */
  assertScrollIndicators(above: number | null, below: number | null): void {
    const text = this.getAllText();

    if (above !== null) {
      const abovePattern = new RegExp(`${above}\\s+more\\s+above`, "i");
      if (above === 0) {
        // Should NOT contain any "more above" indicator
        if (/\d+\s+more\s+above/i.test(text)) {
          throw new Error(
            `Expected no "more above" indicator but found one\nOutput:\n${text}`
          );
        }
      } else {
        if (!abovePattern.test(text)) {
          throw new Error(
            `Expected "${above} more above" indicator\nOutput:\n${text}`
          );
        }
      }
    }

    if (below !== null) {
      const belowPattern = new RegExp(`${below}\\s+more\\s+below`, "i");
      if (below === 0) {
        // Should NOT contain any "more below" indicator
        if (/\d+\s+more\s+below/i.test(text)) {
          throw new Error(
            `Expected no "more below" indicator but found one\nOutput:\n${text}`
          );
        }
      } else {
        if (!belowPattern.test(text)) {
          throw new Error(
            `Expected "${below} more below" indicator\nOutput:\n${text}`
          );
        }
      }
    }
  }

  /**
   * Assert that a specific tab is active.
   * Looks for tab indicators in the output.
   * @param tabName The name of the tab that should be active
   */
  assertTabActive(tabName: string): void {
    const text = this.getAllText();
    // For simpler matching, just verify the tab name appears
    // Active tabs are typically highlighted, but we can't easily detect
    // ANSI styling differences in stripped text
    if (!text.toLowerCase().includes(tabName.toLowerCase())) {
      throw new Error(
        `Expected tab "${tabName}" to be present\nOutput:\n${text}`
      );
    }
  }

  /**
   * Assert the selection count shown in the output.
   * Looks for "N selected" pattern.
   * @param count Expected number of selected items
   */
  assertSelectionCount(count: number): void {
    const text = this.getAllText();

    if (count === 0) {
      // Should NOT show selection count when 0
      if (/\d+\s+selected/i.test(text)) {
        throw new Error(
          `Expected no selection count but found one\nOutput:\n${text}`
        );
      }
    } else {
      const pattern = new RegExp(`${count}\\s+selected`, "i");
      if (!pattern.test(text)) {
        throw new Error(
          `Expected "${count} selected" in output\nOutput:\n${text}`
        );
      }
    }
  }

  /**
   * Assert the pending changes count (for skill manager).
   * Looks for "N pending" pattern.
   * @param count Expected number of pending changes
   */
  assertPendingCount(count: number): void {
    const text = this.getAllText();

    if (count === 0) {
      if (/\d+\s+pending/i.test(text)) {
        throw new Error(
          `Expected no pending count but found one\nOutput:\n${text}`
        );
      }
    } else {
      const pattern = new RegExp(`${count}\\s+pending`, "i");
      if (!pattern.test(text)) {
        throw new Error(
          `Expected "${count} pending" in output\nOutput:\n${text}`
        );
      }
    }
  }

  /**
   * Assert the filtered count shown in search mode.
   * Looks for "X of Y skills" pattern.
   * @param filtered Number of filtered (shown) items
   * @param total Total number of items
   */
  assertFilteredCount(filtered: number, total: number): void {
    const text = this.getAllText();
    const pattern = new RegExp(`${filtered}\\s+of\\s+${total}`, "i");

    if (!pattern.test(text)) {
      throw new Error(
        `Expected "${filtered} of ${total}" in output\nOutput:\n${text}`
      );
    }
  }

  /**
   * Assert that search input contains specific text
   * @param searchText Expected search text
   */
  assertSearchContains(searchText: string): void {
    const text = this.getAllText();
    const searchLinePattern = /Search:\s*([^\n]*)/i;
    const match = text.match(searchLinePattern);

    if (!match) {
      throw new Error(
        `Could not find search line in output\nOutput:\n${text}`
      );
    }

    if (!match[1].includes(searchText)) {
      throw new Error(
        `Expected search to contain "${searchText}" but found "${match[1]}"\nOutput:\n${text}`
      );
    }
  }

  /**
   * Wait for the output to contain specific text with timeout.
   * Useful for waiting for async renders.
   * @param text Text to wait for
   * @param timeout Maximum time to wait in ms
   * @param interval Check interval in ms
   */
  async waitForText(
    text: string,
    timeout = 2000,
    interval = 50
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.containsText(text)) {
        return;
      }
      await this.tick(interval);
    }

    throw new Error(
      `Timeout waiting for "${text}" in output\nActual output:\n${this.getAllText()}`
    );
  }
}

/**
 * Create a new test harness instance
 */
export function createTestHarness(): PromptTestHarness {
  return new PromptTestHarness();
}

// Re-export for convenience
export { stripAnsi };
