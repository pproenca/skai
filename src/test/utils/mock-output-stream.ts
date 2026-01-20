import { Writable } from "node:stream";

/**
 * ANSI escape code patterns for stripping
 */
const ANSI_REGEX = /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

/**
 * Mock output stream that captures rendered output for testing TUI prompts.
 * Provides utilities for accessing and asserting on captured frames.
 */
export class MockOutputStream extends Writable {
  isTTY = true as const;
  rows = 40;
  columns = 120;
  private frames: string[] = [];
  private buffer = "";

  constructor() {
    super({ decodeStrings: false });
  }

  _write(
    chunk: string | Buffer,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    const str = typeof chunk === "string" ? chunk : chunk.toString(encoding);
    this.buffer += str;
    // Capture frame on each write for assertion purposes
    this.frames.push(str);
    callback();
  }

  /**
   * Get all captured raw output (includes ANSI codes)
   */
  getAllOutput(): string {
    return this.buffer;
  }

  /**
   * Get the last frame written
   */
  getLastFrame(): string {
    return this.frames.at(-1) ?? "";
  }

  /**
   * Get the last frame with ANSI codes stripped
   */
  getLastFrameText(): string {
    return stripAnsi(this.getLastFrame());
  }

  /**
   * Get all output with ANSI codes stripped
   */
  getAllText(): string {
    return stripAnsi(this.buffer);
  }

  /**
   * Get all frames (useful for debugging)
   */
  getAllFrames(): string[] {
    return [...this.frames];
  }

  /**
   * Check if the output contains the given text (ANSI stripped)
   */
  containsText(text: string): boolean {
    return this.getAllText().includes(text);
  }

  /**
   * Find lines that match a pattern in the last frame
   */
  findLines(pattern: RegExp | string): string[] {
    const text = this.getLastFrameText();
    const lines = text.split("\n");
    if (typeof pattern === "string") {
      return lines.filter((line) => line.includes(pattern));
    }
    return lines.filter((line) => pattern.test(line));
  }

  /**
   * Find all lines containing text in the complete output
   */
  findAllLines(pattern: RegExp | string): string[] {
    const text = this.getAllText();
    const lines = text.split("\n");
    if (typeof pattern === "string") {
      return lines.filter((line) => line.includes(pattern));
    }
    return lines.filter((line) => pattern.test(line));
  }

  /**
   * Clear captured output (useful between test phases)
   */
  clear(): void {
    this.frames = [];
    this.buffer = "";
  }

  /**
   * Get the number of frames captured
   */
  get frameCount(): number {
    return this.frames.length;
  }

  /**
   * Get cursor position (mock implementation)
   */
  getCursorPos(): { rows: number; cols: number } {
    return { rows: 0, cols: 0 };
  }

  /**
   * Mock cursor hide/show
   */
  cursorTo(_x: number, _y?: number): boolean {
    return true;
  }

  clearLine(_dir: number): boolean {
    return true;
  }

  moveCursor(_dx: number, _dy: number): boolean {
    return true;
  }
}

/**
 * Strip ANSI escape codes from a string
 */
export function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, "");
}
