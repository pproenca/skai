import { Prompt, isCancel } from "@clack/core";
import type { Readable, Writable } from "node:stream";
import color from "picocolors";
import type { Skill } from "../types.js";
import type { SearchableOption } from "./types.js";
import { MAX_SEARCH_LENGTH } from "./types.js";
import { filterOptions } from "./helpers.js";
import { ScrollableList } from "./scrollable-list.js";
import {
  renderHeader,
  renderSubmitState,
  renderCancelState,
  renderAboveIndicator,
  renderBelowIndicator,
  renderFooter,
  renderNoResults,
  renderItemRow,
} from "./render-helpers.js";
import {
  LAYOUT,
  S_BAR,
  createSeparator,
} from "../ui-constants.js";

interface SearchableMultiSelectOptions<T> {
  message: string;
  options: SearchableOption<T>[];
  initialValues?: T[];
  maxItems?: number;
  input?: Readable;
  output?: Writable;
}

export class SearchableMultiSelectPrompt<T> extends Prompt {
  private searchTerm = "";
  private selectedValues: Set<T>;
  private readonly allOptions: SearchableOption<T>[];
  private filteredOptions: SearchableOption<T>[];
  private readonly promptMessage: string;
  private readonly scrollList: ScrollableList;
  // Cleanup tracking
  private keypressHandler!: (ch: string, key: { sequence?: string; ctrl?: boolean; name?: string }) => void;

  constructor(opts: SearchableMultiSelectOptions<T>) {
    super(
      {
        render: () => this.renderPrompt(),
        input: opts.input,
        output: opts.output,
      },
      false
    );
    this.allOptions = opts.options;
    this.filteredOptions = [...opts.options];
    this.selectedValues = new Set(opts.initialValues ?? []);
    this.promptMessage = opts.message;
    this.scrollList = new ScrollableList(opts.maxItems ?? LAYOUT.MAX_VISIBLE_ITEMS);

    this.on("key", (key) => this.handleKey(key ?? ""));
    this.on("cursor", (action) => this.handleCursor(action ?? "up"));

    // Raw keypress listener for Page Up/Down and Ctrl+R
    // The "key" event from @clack/core only passes the first character
    this.keypressHandler = (_ch: string, key: { sequence?: string; ctrl?: boolean; name?: string }) => {
      // Ctrl+R: Clear search
      if (key?.ctrl && key?.name === "r") {
        this.searchTerm = "";
        this.updateFilter();
        return;
      }
      if (key?.sequence === "\x1b[5~") {
        this.scrollList.navigatePage("up", this.filteredOptions.length);
      } else if (key?.sequence === "\x1b[6~") {
        this.scrollList.navigatePage("down", this.filteredOptions.length);
      }
    };
    this.input.on("keypress", this.keypressHandler);
  }

  /**
   * Clean up event listeners
   */
  private cleanup(): void {
    this.input.off("keypress", this.keypressHandler);
  }

  private handleKey(key: string): void {
    // Ignore Tab and Space - handled by cursor events
    if (key === "\t" || key === " ") {
      return;
    }
    if (key === "\x7f" || key === "\b") {
      if (this.searchTerm.length > 0) {
        this.searchTerm = this.searchTerm.slice(0, -1);
        this.updateFilter();
      }
      return;
    }
    if (key.length === 1 && /[a-z0-9\-_./]/i.test(key)) {
      // Enforce max search length to prevent display issues
      if (this.searchTerm.length >= MAX_SEARCH_LENGTH) return;
      this.searchTerm += key;
      this.updateFilter();
    }
  }

  private handleCursor(
    action: "up" | "down" | "left" | "right" | "space" | "enter" | "cancel"
  ): void {
    switch (action) {
      case "up":
        this.scrollList.navigate("up", this.filteredOptions.length);
        break;
      case "down":
        this.scrollList.navigate("down", this.filteredOptions.length);
        break;
      case "space":
        this.toggleSelection();
        break;
      case "cancel":
        if (this.searchTerm) {
          this.searchTerm = "";
          this.updateFilter();
        } else {
          // No search term - cancel the prompt
          this.cleanup();
          this.state = "cancel";
          this.close();
        }
        break;
    }
  }

  private updateFilter(): void {
    this.filteredOptions = filterOptions(this.allOptions, this.searchTerm);
    this.scrollList.reset(this.filteredOptions.length);
  }

  private toggleSelection(): void {
    const current = this.filteredOptions[this.scrollList.cursor];
    if (!current) return;

    if (this.selectedValues.has(current.value)) {
      this.selectedValues.delete(current.value);
    } else {
      this.selectedValues.add(current.value);
    }
  }

  private renderPrompt(): string {
    const lines: string[] = [];
    const total = this.allOptions.length;
    const filtered = this.filteredOptions.length;

    // Header
    lines.push(...renderHeader(this.state, this.promptMessage));

    // Submit state
    if (this.state === "submit") {
      const selectedLabels = this.allOptions
        .filter((opt) => this.selectedValues.has(opt.value))
        .map((opt) => opt.option.label);
      lines.push(...renderSubmitState(selectedLabels));
      return lines.join("\n");
    }

    // Cancel state
    if (this.state === "cancel") {
      const selectedLabels = this.allOptions
        .filter((opt) => this.selectedValues.has(opt.value))
        .map((opt) => opt.option.label);
      lines.push(...renderCancelState(selectedLabels));
      return lines.join("\n");
    }

    // Search UI
    const selectedCount = this.selectedValues.size;
    const countText =
      this.searchTerm || filtered !== total
        ? `(${filtered} of ${total} skills)`
        : `(${total} skills)`;
    const selectedText =
      selectedCount > 0 ? color.green(` • ${selectedCount} selected`) : "";

    const cursor = this.state === "active" ? color.inverse(" ") : "_";
    lines.push(
      `${color.cyan(S_BAR)}  Search: ${this.searchTerm}${cursor}  ${color.dim(countText)}${selectedText}`
    );
    lines.push(
      `${color.cyan(S_BAR)}  ${color.dim("↑↓ nav • PgUp/Dn • space • ^R clear • Esc • enter")}`
    );
    lines.push(`${color.cyan(S_BAR)}`);
    lines.push(`${color.cyan(S_BAR)}  ${createSeparator()}`);

    // No results
    if (this.filteredOptions.length === 0) {
      lines.push(...renderNoResults(this.searchTerm));
    } else {
      const { aboveCount, belowCount } = this.scrollList.getScrollIndicators(this.filteredOptions.length);
      const { start, end } = this.scrollList.getVisibleRange();

      // Above indicator
      lines.push(...renderAboveIndicator(aboveCount));

      // Visible items
      const visibleOptions = this.filteredOptions.slice(start, end);
      for (let i = 0; i < visibleOptions.length; i++) {
        const opt = visibleOptions[i];
        const globalIndex = start + i;
        const isActive = globalIndex === this.scrollList.cursor;
        const isSelected = this.selectedValues.has(opt.value);

        lines.push(renderItemRow({
          label: opt.option.label,
          hint: opt.option.hint,
          isSelected,
          isActive,
          searchTerm: this.searchTerm,
        }));
      }

      // Below indicator
      lines.push(...renderBelowIndicator(belowCount));
    }

    lines.push(...renderFooter());
    return lines.join("\n");
  }

  async run(): Promise<T[] | symbol> {
    const result = await this.prompt();
    // Ensure cleanup on all exit paths (submit case)
    this.cleanup();
    if (isCancel(result)) {
      return result;
    }
    return Array.from(this.selectedValues);
  }
}

export async function searchableMultiselect(
  searchableOptions: SearchableOption<Skill>[]
): Promise<Skill[]> {
  const prompt = new SearchableMultiSelectPrompt<Skill>({
    message: "Select skills to install:",
    options: searchableOptions,
  });
  const result = await prompt.run();
  if (isCancel(result)) {
    throw new Error("Selection cancelled");
  }
  return result;
}
