import { Readable } from "node:stream";
import * as readline from "node:readline";

/**
 * Key codes for common terminal input sequences
 */
export const KEY_CODES = {
  UP: "\x1b[A",
  DOWN: "\x1b[B",
  LEFT: "\x1b[D",
  RIGHT: "\x1b[C",
  PAGE_UP: "\x1b[5~",
  PAGE_DOWN: "\x1b[6~",
  ENTER: "\r",
  SPACE: " ",
  ESCAPE: "\x1b",
  BACKSPACE: "\x7f",
  TAB: "\t",
  CTRL_C: "\x03",
  CTRL_R: "\x12",
} as const;

/**
 * Mock input stream that simulates keyboard input for testing TUI prompts.
 * Extends Readable and provides TTY-like interface required by @clack/core.
 *
 * Uses readline.emitKeypressEvents to properly parse and emit keypress events
 * from the raw data stream, matching how @clack/core expects to receive input.
 */
export class MockInputStream extends Readable {
  isTTY = true as const;
  isRaw = false;
  private pendingData: string[] = [];
  private isProcessing = false;

  constructor() {
    super({ encoding: "utf8" });
    // Enable keypress events on this stream - this parses raw data
    // and emits keypress events that @clack/core listens for
    readline.emitKeypressEvents(this);
  }

  /**
   * Required by @clack/core for raw mode terminal
   */
  setRawMode(mode: boolean): this {
    this.isRaw = mode;
    return this;
  }

  _read(): void {
    // No-op: we push data manually
  }

  /**
   * Queue data for emission and process the queue
   */
  private queueData(data: string): void {
    this.pendingData.push(data);
    this.processQueue();
  }

  /**
   * Process queued data asynchronously
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.pendingData.length > 0) {
      const data = this.pendingData.shift()!;
      this.push(data);
      // Small delay between keys to allow event processing
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    this.isProcessing = false;
  }

  /**
   * Press up arrow
   */
  pressUp(): void {
    this.queueData(KEY_CODES.UP);
  }

  /**
   * Press down arrow
   */
  pressDown(): void {
    this.queueData(KEY_CODES.DOWN);
  }

  /**
   * Press left arrow
   */
  pressLeft(): void {
    this.queueData(KEY_CODES.LEFT);
  }

  /**
   * Press right arrow
   */
  pressRight(): void {
    this.queueData(KEY_CODES.RIGHT);
  }

  /**
   * Press Page Up
   */
  pressPageUp(): void {
    this.queueData(KEY_CODES.PAGE_UP);
  }

  /**
   * Press Page Down
   */
  pressPageDown(): void {
    this.queueData(KEY_CODES.PAGE_DOWN);
  }

  /**
   * Press Enter
   */
  pressEnter(): void {
    this.queueData(KEY_CODES.ENTER);
  }

  /**
   * Press Space
   */
  pressSpace(): void {
    this.queueData(KEY_CODES.SPACE);
  }

  /**
   * Press Escape
   */
  pressEscape(): void {
    this.queueData(KEY_CODES.ESCAPE);
  }

  /**
   * Press Backspace
   */
  pressBackspace(): void {
    this.queueData(KEY_CODES.BACKSPACE);
  }

  /**
   * Press Tab
   */
  pressTab(): void {
    this.queueData(KEY_CODES.TAB);
  }

  /**
   * Press Shift+Tab (reverse tab)
   */
  pressShiftTab(): void {
    this.queueData("\x1b[Z");
  }

  /**
   * Press Ctrl+C
   */
  pressCtrlC(): void {
    this.queueData(KEY_CODES.CTRL_C);
  }

  /**
   * Press Ctrl+R
   */
  pressCtrlR(): void {
    this.queueData(KEY_CODES.CTRL_R);
  }

  /**
   * Type a string character by character
   */
  type(text: string): void {
    for (const char of text) {
      this.queueData(char);
    }
  }

  /**
   * Wait for all queued data to be processed
   */
  async flush(): Promise<void> {
    while (this.pendingData.length > 0 || this.isProcessing) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    // Extra delay for readline processing
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
