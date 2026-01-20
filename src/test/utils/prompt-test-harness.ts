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
}

/**
 * Create a new test harness instance
 */
export function createTestHarness(): PromptTestHarness {
  return new PromptTestHarness();
}

// Re-export for convenience
export { stripAnsi };
