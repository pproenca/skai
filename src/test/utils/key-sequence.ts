import type { MockInputStream } from "./mock-input-stream.js";

/**
 * Fluent builder for creating sequences of key inputs.
 * Allows chaining multiple key presses for cleaner test code.
 *
 * @example
 * ```typescript
 * // Navigate down twice, select with space, then submit
 * keys(input).down().down().space().enter();
 *
 * // Type search text and navigate
 * keys(input).type("python").down().space().enter();
 * ```
 */
export class KeySequence {
  constructor(private input: MockInputStream) {}

  /**
   * Press up arrow
   */
  up(times = 1): this {
    for (let i = 0; i < times; i++) {
      this.input.pressUp();
    }
    return this;
  }

  /**
   * Press down arrow
   */
  down(times = 1): this {
    for (let i = 0; i < times; i++) {
      this.input.pressDown();
    }
    return this;
  }

  /**
   * Press left arrow
   */
  left(times = 1): this {
    for (let i = 0; i < times; i++) {
      this.input.pressLeft();
    }
    return this;
  }

  /**
   * Press right arrow
   */
  right(times = 1): this {
    for (let i = 0; i < times; i++) {
      this.input.pressRight();
    }
    return this;
  }

  /**
   * Press Page Up
   */
  pageUp(times = 1): this {
    for (let i = 0; i < times; i++) {
      this.input.pressPageUp();
    }
    return this;
  }

  /**
   * Press Page Down
   */
  pageDown(times = 1): this {
    for (let i = 0; i < times; i++) {
      this.input.pressPageDown();
    }
    return this;
  }

  /**
   * Press Enter
   */
  enter(): this {
    this.input.pressEnter();
    return this;
  }

  /**
   * Press Space
   */
  space(): this {
    this.input.pressSpace();
    return this;
  }

  /**
   * Press Escape
   */
  escape(): this {
    this.input.pressEscape();
    return this;
  }

  /**
   * Press Backspace
   */
  backspace(times = 1): this {
    for (let i = 0; i < times; i++) {
      this.input.pressBackspace();
    }
    return this;
  }

  /**
   * Press Tab
   */
  tab(times = 1): this {
    for (let i = 0; i < times; i++) {
      this.input.pressTab();
    }
    return this;
  }

  /**
   * Press Shift+Tab
   */
  shiftTab(times = 1): this {
    for (let i = 0; i < times; i++) {
      this.input.pressShiftTab();
    }
    return this;
  }

  /**
   * Press Ctrl+C
   */
  ctrlC(): this {
    this.input.pressCtrlC();
    return this;
  }

  /**
   * Press Ctrl+R
   */
  ctrlR(): this {
    this.input.pressCtrlR();
    return this;
  }

  /**
   * Type text character by character
   */
  type(text: string): this {
    this.input.type(text);
    return this;
  }

  /**
   * Wait for all queued keys to be processed
   */
  async flush(): Promise<this> {
    await this.input.flush();
    return this;
  }
}

/**
 * Factory function to create a key sequence builder
 */
export function keys(input: MockInputStream): KeySequence {
  return new KeySequence(input);
}
