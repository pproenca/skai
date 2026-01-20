import { Prompt, isCancel } from "@clack/core";
import color from "picocolors";
import type {
  SkillOption,
  SearchableGroupOption,
  GroupedSearchableOptions,
  FlatGroupItem,
} from "./types.js";
import { MAX_SEARCH_LENGTH } from "./types.js";
import { buildGroupedSearchableOptions } from "./helpers.js";
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
  renderGroupRow,
} from "./render-helpers.js";
import {
  LAYOUT,
  S_BAR,
  createSeparator,
} from "../ui-constants.js";

interface SearchableGroupMultiSelectOptions<T> {
  message: string;
  groups: Record<string, SkillOption[]>;
  initialValues?: T[];
  maxItems?: number;
}

export class SearchableGroupMultiSelectPrompt<T> extends Prompt {
  private searchTerm = "";
  private selectedValues: Set<T>;
  private readonly groupedOptions: GroupedSearchableOptions<T>[];
  private flatItems: FlatGroupItem<T>[] = [];
  private readonly promptMessage: string;
  private readonly scrollList: ScrollableList;

  constructor(opts: SearchableGroupMultiSelectOptions<T>) {
    super(
      {
        render: () => this.renderPrompt(),
      },
      false
    );
    this.groupedOptions = buildGroupedSearchableOptions(
      opts.groups
    ) as GroupedSearchableOptions<T>[];
    this.selectedValues = new Set(opts.initialValues ?? []);
    this.promptMessage = opts.message;
    this.scrollList = new ScrollableList(opts.maxItems ?? LAYOUT.MAX_VISIBLE_ITEMS);
    this.rebuildFlatItems();

    this.on("key", (key) => this.handleKey(key ?? ""));
    this.on("cursor", (action) => this.handleCursor(action ?? "up"));

    // Raw keypress listener for Page Up/Down and Ctrl+R
    // The "key" event from @clack/core only passes the first character
    this.input.on("keypress", (_ch: string, key: { sequence?: string; ctrl?: boolean; name?: string }) => {
      // Ctrl+R: Clear search
      if (key?.ctrl && key?.name === "r") {
        this.searchTerm = "";
        this.updateFilter();
        return;
      }
      if (key?.sequence === "\x1b[5~") {
        this.scrollList.navigatePage("up", this.flatItems.length);
      } else if (key?.sequence === "\x1b[6~") {
        this.scrollList.navigatePage("down", this.flatItems.length);
      }
    });
  }

  private rebuildFlatItems(): void {
    this.flatItems = [];
    const term = this.searchTerm.toLowerCase();

    for (const group of this.groupedOptions) {
      const groupMatches = !term || group.searchableText.includes(term);
      const matchingOptions = groupMatches
        ? group.options
        : group.options.filter((opt) => opt.searchableText.includes(term));

      if (matchingOptions.length > 0) {
        this.flatItems.push({
          type: "group",
          name: group.groupName,
          searchable: group.searchableText,
        });
        for (const opt of matchingOptions) {
          this.flatItems.push({
            type: "option",
            option: opt,
            groupName: group.groupName,
          });
        }
      }
    }
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
        this.scrollList.navigate("up", this.flatItems.length);
        break;
      case "down":
        this.scrollList.navigate("down", this.flatItems.length);
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
          this.state = "cancel";
          this.close();
        }
        break;
    }
  }

  private updateFilter(): void {
    this.rebuildFlatItems();
    this.scrollList.reset(this.flatItems.length);
  }

  private getGroupOptions(groupName: string): SearchableGroupOption<T>[] {
    const group = this.groupedOptions.find((g) => g.groupName === groupName);
    return group?.options ?? [];
  }

  private isGroupSelected(groupName: string): boolean {
    const options = this.getGroupOptions(groupName);
    return (
      options.length > 0 &&
      options.every((opt) => this.selectedValues.has(opt.value))
    );
  }

  private toggleSelection(): void {
    const current = this.flatItems[this.scrollList.cursor];
    if (!current) return;

    if (current.type === "group") {
      const options = this.getGroupOptions(current.name);
      const allSelected = this.isGroupSelected(current.name);
      for (const opt of options) {
        if (allSelected) {
          this.selectedValues.delete(opt.value);
        } else {
          this.selectedValues.add(opt.value);
        }
      }
    } else {
      const val = current.option.value;
      if (this.selectedValues.has(val)) {
        this.selectedValues.delete(val);
      } else {
        this.selectedValues.add(val);
      }
    }
  }

  private getTotalOptionCount(): number {
    return this.groupedOptions.reduce((sum, g) => sum + g.options.length, 0);
  }

  private getFilteredOptionCount(): number {
    return this.flatItems.filter((item) => item.type === "option").length;
  }

  private renderPrompt(): string {
    const lines: string[] = [];
    const total = this.getTotalOptionCount();
    const filtered = this.getFilteredOptionCount();

    // Header
    lines.push(...renderHeader(this.state, this.promptMessage));

    // Submit state
    if (this.state === "submit") {
      const selectedLabels = this.groupedOptions
        .flatMap((g) => g.options)
        .filter((opt) => this.selectedValues.has(opt.value))
        .map((opt) => opt.option.label);
      lines.push(...renderSubmitState(selectedLabels));
      return lines.join("\n");
    }

    // Cancel state
    if (this.state === "cancel") {
      const selectedLabels = this.groupedOptions
        .flatMap((g) => g.options)
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
    if (this.flatItems.length === 0) {
      lines.push(...renderNoResults(this.searchTerm));
    } else {
      const { aboveCount, belowCount } = this.scrollList.getScrollIndicators(this.flatItems.length);
      const { start, end } = this.scrollList.getVisibleRange();

      // Above indicator
      lines.push(...renderAboveIndicator(aboveCount));

      const visibleItems = this.flatItems.slice(start, end);

      for (let i = 0; i < visibleItems.length; i++) {
        const item = visibleItems[i];
        const globalIndex = start + i;
        const isActive = globalIndex === this.scrollList.cursor;

        if (item.type === "group") {
          const groupOptions = this.getGroupOptions(item.name);
          const groupSelectedCount = groupOptions.filter((opt) =>
            this.selectedValues.has(opt.value)
          ).length;
          lines.push(renderGroupRow({
            groupName: item.name,
            selectedCount: groupSelectedCount,
            totalCount: groupOptions.length,
            isAllSelected: this.isGroupSelected(item.name),
            isActive,
            searchTerm: this.searchTerm,
          }));
        } else {
          const isSelected = this.selectedValues.has(item.option.value);
          const isLastInGroup =
            i + 1 >= visibleItems.length ||
            visibleItems[i + 1].type === "group";
          const indent = isLastInGroup
            ? `${color.gray("└")} `
            : `${color.gray("│")} `;

          lines.push(renderItemRow({
            label: item.option.option.label,
            hint: item.option.option.hint,
            isSelected,
            isActive,
            searchTerm: this.searchTerm,
            indent,
          }));
        }
      }

      // Below indicator
      lines.push(...renderBelowIndicator(belowCount));
    }

    lines.push(...renderFooter());
    return lines.join("\n");
  }

  async run(): Promise<T[] | symbol> {
    const result = await this.prompt();
    if (isCancel(result)) {
      return result;
    }
    return Array.from(this.selectedValues);
  }
}
