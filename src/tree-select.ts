import * as p from "@clack/prompts";
import { Prompt, isCancel } from "@clack/core";
import color from "picocolors";
import type { Skill, TreeNode } from "./types.js";

export interface FlatNode {
  node: TreeNode;
  depth: number;
  parentId?: string;
}

/**
 * Flatten tree nodes for traversal (kept for potential test usage)
 */
export function flattenNodes(
  nodes: TreeNode[],
  expanded: Set<string>,
  depth = 0,
  parentId?: string
): FlatNode[] {
  const result: FlatNode[] = [];

  for (const node of nodes) {
    result.push({ node, depth, parentId });

    if (node.children && node.children.length > 0 && expanded.has(node.id)) {
      result.push(...flattenNodes(node.children, expanded, depth + 1, node.id));
    }
  }

  return result;
}

/**
 * Count selected skills in a node subtree (kept for potential test usage)
 */
export function countSelected(
  node: TreeNode,
  selected: Set<string>
): { selected: number; total: number } {
  if (node.skill) {
    return { selected: selected.has(node.id) ? 1 : 0, total: 1 };
  }

  let total = 0;
  let selectedCount = 0;

  for (const child of node.children || []) {
    const counts = countSelected(child, selected);
    total += counts.total;
    selectedCount += counts.selected;
  }

  return { selected: selectedCount, total };
}

/**
 * Get all skill IDs from a node subtree (kept for potential test usage)
 */
export function getAllSkillIds(node: TreeNode): string[] {
  if (node.skill) {
    return [node.id];
  }

  const ids: string[] = [];
  for (const child of node.children || []) {
    ids.push(...getAllSkillIds(child));
  }
  return ids;
}

type SkillOption = { value: Skill; label: string; hint?: string };

const SEARCH_THRESHOLD = 5;
const MAX_VISIBLE_ITEMS = 10;

const S_STEP_ACTIVE = color.green("◆");
const S_STEP_CANCEL = color.red("■");
const S_STEP_SUBMIT = color.green("◇");
const S_BAR = color.gray("│");
const S_BAR_END = color.gray("└");
const S_CHECKBOX_ACTIVE = color.cyan("◻");
const S_CHECKBOX_SELECTED = color.green("◼");
const S_CHECKBOX_INACTIVE = color.dim("◻");

const MAX_HINT_LENGTH = 60;

function truncateHint(hint: string | undefined, maxLen: number): string {
  if (!hint) return "";
  if (hint.length <= maxLen) return hint;
  return hint.slice(0, maxLen - 1) + "…";
}

function wrapText(text: string, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

const DESCRIPTION_INDENT = "       ";
const DESCRIPTION_MAX_WIDTH = 60;

interface SearchableOption<T> {
  option: SkillOption;
  searchableText: string;
  value: T;
}

function buildSearchableOptions(
  options: SkillOption[]
): SearchableOption<Skill>[] {
  return options.map((opt) => ({
    option: opt,
    value: opt.value,
    searchableText: [opt.label, opt.hint || "", opt.value.description || ""]
      .join("|")
      .toLowerCase(),
  }));
}

function filterOptions<T>(
  options: SearchableOption<T>[],
  searchTerm: string
): SearchableOption<T>[] {
  if (!searchTerm) return options;
  const term = searchTerm.toLowerCase();
  return options.filter((opt) => opt.searchableText.includes(term));
}

function highlightMatch(text: string, searchTerm: string): string {
  if (!searchTerm) return text;

  const lowerText = text.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();
  const index = lowerText.indexOf(lowerTerm);

  if (index === -1) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + searchTerm.length);
  const after = text.slice(index + searchTerm.length);

  return `${before}${color.cyan(match)}${after}`;
}

function symbol(state: string): string {
  switch (state) {
    case "active":
      return S_STEP_ACTIVE;
    case "cancel":
      return S_STEP_CANCEL;
    case "submit":
      return S_STEP_SUBMIT;
    default:
      return color.cyan("◆");
  }
}

interface SearchableMultiSelectOptions<T> {
  message: string;
  options: SearchableOption<T>[];
  initialValues?: T[];
  maxItems?: number;
}

class SearchableMultiSelectPrompt<T> extends Prompt {
  private searchTerm = "";
  private listCursor = 0;
  private selectedValues: Set<T>;
  private readonly allOptions: SearchableOption<T>[];
  private filteredOptions: SearchableOption<T>[];
  private scrollOffset = 0;
  private readonly maxItems: number;
  private readonly promptMessage: string;

  constructor(opts: SearchableMultiSelectOptions<T>) {
    super(
      {
        render: () => this.renderPrompt(),
      },
      false
    );
    this.allOptions = opts.options;
    this.filteredOptions = [...opts.options];
    this.selectedValues = new Set(opts.initialValues ?? []);
    this.maxItems = opts.maxItems ?? MAX_VISIBLE_ITEMS;
    this.promptMessage = opts.message;

    this.on("key", (key) => this.handleKey(key ?? ""));
    this.on("cursor", (action) => this.handleCursor(action ?? "up"));
  }

  private handleKey(key: string): void {
    if (key.length === 1 && /[a-z0-9\-_./\s]/i.test(key)) {
      this.searchTerm += key;
      this.updateFilter();
    }
  }

  private handleCursor(
    action: "up" | "down" | "left" | "right" | "space" | "enter" | "cancel"
  ): void {
    switch (action) {
      case "up":
        this.listCursor = Math.max(0, this.listCursor - 1);
        this.adjustScroll();
        break;
      case "down":
        this.listCursor = Math.min(
          this.filteredOptions.length - 1,
          this.listCursor + 1
        );
        this.adjustScroll();
        break;
      case "space":
        this.toggleSelection();
        break;
      case "cancel":
        if (this.searchTerm) {
          this.searchTerm = "";
          this.updateFilter();
        }
        break;
    }
  }

  private adjustScroll(): void {
    if (this.listCursor < this.scrollOffset) {
      this.scrollOffset = this.listCursor;
    } else if (this.listCursor >= this.scrollOffset + this.maxItems) {
      this.scrollOffset = this.listCursor - this.maxItems + 1;
    }
  }

  private updateFilter(): void {
    this.filteredOptions = filterOptions(this.allOptions, this.searchTerm);
    this.listCursor = Math.min(
      this.listCursor,
      Math.max(0, this.filteredOptions.length - 1)
    );
    this.scrollOffset = 0;
    this.adjustScroll();
  }

  private toggleSelection(): void {
    const current = this.filteredOptions[this.listCursor];
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

    lines.push(`${color.gray(S_BAR)}`);
    lines.push(`${symbol(this.state)}  ${this.promptMessage}`);

    if (this.state === "submit") {
      const selectedLabels = this.allOptions
        .filter((opt) => this.selectedValues.has(opt.value))
        .map((opt) => opt.option.label);
      lines.push(
        `${color.gray(S_BAR)}  ${color.dim(selectedLabels.join(", ") || "none")}`
      );
      return lines.join("\n");
    }

    if (this.state === "cancel") {
      const selectedLabels = this.allOptions
        .filter((opt) => this.selectedValues.has(opt.value))
        .map((opt) => color.strikethrough(color.dim(opt.option.label)));
      if (selectedLabels.length > 0) {
        lines.push(`${color.gray(S_BAR)}  ${selectedLabels.join(", ")}`);
      }
      lines.push(`${color.gray(S_BAR)}`);
      return lines.join("\n");
    }

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
      `${color.cyan(S_BAR)}  ${color.dim("↑/↓ navigate • space select • enter confirm")}`
    );
    lines.push(`${color.cyan(S_BAR)}  ${color.dim("─".repeat(40))}`);

    if (this.filteredOptions.length === 0) {
      lines.push(
        `${color.cyan(S_BAR)}  ${color.dim(`No skills match "${this.searchTerm}"`)}`
      );
    } else {
      const aboveCount = this.scrollOffset;
      const belowCount = Math.max(
        0,
        this.filteredOptions.length - this.scrollOffset - this.maxItems
      );

      if (aboveCount > 0) {
        lines.push(
          `${color.cyan(S_BAR)}  ${color.dim(`↑ ${aboveCount} more above`)}`
        );
      }

      const visibleOptions = this.filteredOptions.slice(
        this.scrollOffset,
        this.scrollOffset + this.maxItems
      );

      for (let i = 0; i < visibleOptions.length; i++) {
        const opt = visibleOptions[i];
        const globalIndex = this.scrollOffset + i;
        const isActive = globalIndex === this.listCursor;
        const isSelected = this.selectedValues.has(opt.value);

        let checkbox: string;
        if (isActive && isSelected) {
          checkbox = S_CHECKBOX_SELECTED;
        } else if (isSelected) {
          checkbox = S_CHECKBOX_SELECTED;
        } else if (isActive) {
          checkbox = S_CHECKBOX_ACTIVE;
        } else {
          checkbox = S_CHECKBOX_INACTIVE;
        }

        const label = this.searchTerm
          ? highlightMatch(opt.option.label, this.searchTerm)
          : opt.option.label;

        const fullHint = opt.option.hint || "";
        const needsTruncation = fullHint.length > MAX_HINT_LENGTH;
        const displayHint = needsTruncation
          ? truncateHint(fullHint, MAX_HINT_LENGTH)
          : fullHint;
        const hint = displayHint ? color.dim(` (${displayHint})`) : "";

        const line = isActive
          ? `${checkbox} ${label}${hint}`
          : `${checkbox} ${color.dim(opt.option.label)}${color.dim(hint)}`;

        lines.push(`${color.cyan(S_BAR)}  ${line}`);

        if (isActive && needsTruncation) {
          const wrappedLines = wrapText(fullHint, DESCRIPTION_MAX_WIDTH);
          for (const descLine of wrappedLines) {
            lines.push(
              `${color.cyan(S_BAR)}  ${DESCRIPTION_INDENT}${color.dim(descLine)}`
            );
          }
        }
      }

      if (belowCount > 0) {
        lines.push(
          `${color.cyan(S_BAR)}  ${color.dim(`↓ ${belowCount} more below`)}`
        );
      }
    }

    lines.push(`${color.cyan(S_BAR_END)}`);
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

interface SearchableGroupOption<T> {
  option: SkillOption;
  searchableText: string;
  value: T;
  group: string;
}

interface GroupedSearchableOptions<T> {
  groupName: string;
  options: SearchableGroupOption<T>[];
  searchableText: string;
}

function buildGroupedSearchableOptions(
  groups: Record<string, SkillOption[]>
): GroupedSearchableOptions<Skill>[] {
  return Object.entries(groups).map(([groupName, options]) => ({
    groupName,
    searchableText: groupName.toLowerCase(),
    options: options.map((opt) => ({
      option: opt,
      value: opt.value,
      group: groupName,
      searchableText: [
        opt.label,
        groupName,
        opt.hint || "",
        opt.value.description || "",
      ]
        .join("|")
        .toLowerCase(),
    })),
  }));
}

interface SearchableGroupMultiSelectOptions<T> {
  message: string;
  groups: Record<string, SkillOption[]>;
  initialValues?: T[];
  maxItems?: number;
}

type FlatGroupItem<T> =
  | { type: "group"; name: string; searchable: string }
  | { type: "option"; option: SearchableGroupOption<T>; groupName: string };

class SearchableGroupMultiSelectPrompt<T> extends Prompt {
  private searchTerm = "";
  private listCursor = 0;
  private selectedValues: Set<T>;
  private readonly groupedOptions: GroupedSearchableOptions<T>[];
  private flatItems: FlatGroupItem<T>[] = [];
  private scrollOffset = 0;
  private readonly maxItems: number;
  private readonly promptMessage: string;

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
    this.maxItems = opts.maxItems ?? MAX_VISIBLE_ITEMS;
    this.promptMessage = opts.message;
    this.rebuildFlatItems();

    this.on("key", (key) => this.handleKey(key ?? ""));
    this.on("cursor", (action) => this.handleCursor(action ?? "up"));
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
    if (key.length === 1 && /[a-z0-9\-_./\s]/i.test(key)) {
      this.searchTerm += key;
      this.updateFilter();
    }
  }

  private handleCursor(
    action: "up" | "down" | "left" | "right" | "space" | "enter" | "cancel"
  ): void {
    switch (action) {
      case "up":
        this.listCursor = Math.max(0, this.listCursor - 1);
        this.adjustScroll();
        break;
      case "down":
        this.listCursor = Math.min(
          this.flatItems.length - 1,
          this.listCursor + 1
        );
        this.adjustScroll();
        break;
      case "space":
        this.toggleSelection();
        break;
      case "cancel":
        if (this.searchTerm) {
          this.searchTerm = "";
          this.updateFilter();
        }
        break;
    }
  }

  private adjustScroll(): void {
    if (this.listCursor < this.scrollOffset) {
      this.scrollOffset = this.listCursor;
    } else if (this.listCursor >= this.scrollOffset + this.maxItems) {
      this.scrollOffset = this.listCursor - this.maxItems + 1;
    }
  }

  private updateFilter(): void {
    this.rebuildFlatItems();
    this.listCursor = Math.min(
      this.listCursor,
      Math.max(0, this.flatItems.length - 1)
    );
    this.scrollOffset = 0;
    this.adjustScroll();
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
    const current = this.flatItems[this.listCursor];
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

    lines.push(`${color.gray(S_BAR)}`);
    lines.push(`${symbol(this.state)}  ${this.promptMessage}`);

    if (this.state === "submit") {
      const selectedLabels = this.groupedOptions
        .flatMap((g) => g.options)
        .filter((opt) => this.selectedValues.has(opt.value))
        .map((opt) => opt.option.label);
      lines.push(
        `${color.gray(S_BAR)}  ${color.dim(selectedLabels.join(", ") || "none")}`
      );
      return lines.join("\n");
    }

    if (this.state === "cancel") {
      const selectedLabels = this.groupedOptions
        .flatMap((g) => g.options)
        .filter((opt) => this.selectedValues.has(opt.value))
        .map((opt) => color.strikethrough(color.dim(opt.option.label)));
      if (selectedLabels.length > 0) {
        lines.push(`${color.gray(S_BAR)}  ${selectedLabels.join(", ")}`);
      }
      lines.push(`${color.gray(S_BAR)}`);
      return lines.join("\n");
    }

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
      `${color.cyan(S_BAR)}  ${color.dim("↑/↓ navigate • space select • enter confirm")}`
    );
    lines.push(`${color.cyan(S_BAR)}  ${color.dim("─".repeat(40))}`);

    if (this.flatItems.length === 0) {
      lines.push(
        `${color.cyan(S_BAR)}  ${color.dim(`No skills match "${this.searchTerm}"`)}`
      );
    } else {
      const aboveCount = this.scrollOffset;
      const belowCount = Math.max(
        0,
        this.flatItems.length - this.scrollOffset - this.maxItems
      );

      if (aboveCount > 0) {
        lines.push(
          `${color.cyan(S_BAR)}  ${color.dim(`↑ ${aboveCount} more above`)}`
        );
      }

      const visibleItems = this.flatItems.slice(
        this.scrollOffset,
        this.scrollOffset + this.maxItems
      );

      for (let i = 0; i < visibleItems.length; i++) {
        const item = visibleItems[i];
        const globalIndex = this.scrollOffset + i;
        const isActive = globalIndex === this.listCursor;

        if (item.type === "group") {
          const groupOptions = this.getGroupOptions(item.name);
          const groupSelectedCount = groupOptions.filter((opt) =>
            this.selectedValues.has(opt.value)
          ).length;
          const groupSelected = this.isGroupSelected(item.name);
          const checkbox = groupSelected
            ? S_CHECKBOX_SELECTED
            : isActive
              ? S_CHECKBOX_ACTIVE
              : S_CHECKBOX_INACTIVE;
          const label = this.searchTerm
            ? highlightMatch(item.name, this.searchTerm)
            : item.name;
          const countHint =
            groupSelectedCount > 0
              ? color.dim(` (${groupSelectedCount}/${groupOptions.length})`)
              : color.dim(` (${groupOptions.length})`);
          const line = isActive
            ? `${checkbox} ${color.bold(label)}${countHint}`
            : `${checkbox} ${color.dim(item.name)}${countHint}`;
          lines.push(`${color.cyan(S_BAR)}  ${line}`);
        } else {
          const isSelected = this.selectedValues.has(item.option.value);
          let checkbox: string;
          if (isSelected) {
            checkbox = S_CHECKBOX_SELECTED;
          } else if (isActive) {
            checkbox = S_CHECKBOX_ACTIVE;
          } else {
            checkbox = S_CHECKBOX_INACTIVE;
          }

          const label = this.searchTerm
            ? highlightMatch(item.option.option.label, this.searchTerm)
            : item.option.option.label;
          const fullHint = item.option.option.hint || "";
          const needsTruncation = fullHint.length > MAX_HINT_LENGTH;
          const displayHint = needsTruncation
            ? truncateHint(fullHint, MAX_HINT_LENGTH)
            : fullHint;
          const hint = displayHint ? color.dim(` (${displayHint})`) : "";

          const isLastInGroup =
            i + 1 >= visibleItems.length ||
            visibleItems[i + 1].type === "group";
          const indent = isLastInGroup
            ? `${color.gray("└")} `
            : `${color.gray("│")} `;

          const line = isActive
            ? `${indent}${checkbox} ${label}${hint}`
            : `${indent}${checkbox} ${color.dim(item.option.option.label)}${color.dim(hint)}`;

          lines.push(`${color.cyan(S_BAR)}  ${line}`);

          if (isActive && needsTruncation) {
            const descIndent = isLastInGroup ? "  " : `${color.gray("│")} `;
            const wrappedLines = wrapText(fullHint, DESCRIPTION_MAX_WIDTH);
            for (const descLine of wrappedLines) {
              lines.push(
                `${color.cyan(S_BAR)}  ${descIndent}${DESCRIPTION_INDENT}${color.dim(descLine)}`
              );
            }
          }
        }
      }

      if (belowCount > 0) {
        lines.push(
          `${color.cyan(S_BAR)}  ${color.dim(`↓ ${belowCount} more below`)}`
        );
      }
    }

    lines.push(`${color.cyan(S_BAR_END)}`);
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

async function searchableMultiselect(
  options: SkillOption[]
): Promise<Skill[]> {
  const searchableOptions = buildSearchableOptions(options);
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

async function searchableGroupMultiselect(
  groups: Record<string, SkillOption[]>
): Promise<Skill[]> {
  const prompt = new SearchableGroupMultiSelectPrompt<Skill>({
    message: "Select skills to install:",
    groups,
  });
  const result = await prompt.run();
  if (isCancel(result)) {
    throw new Error("Selection cancelled");
  }
  return result;
}

function countTotalOptions(
  uncategorized: SkillOption[],
  groups: Record<string, SkillOption[]>
): number {
  const groupCount = Object.values(groups).reduce(
    (sum, opts) => sum + opts.length,
    0
  );
  return uncategorized.length + groupCount;
}

/**
 * Separate skills into categorized (have group) and uncategorized (no group)
 */
function categorizeNodes(nodes: TreeNode[]): {
  uncategorized: SkillOption[];
  groups: Record<string, SkillOption[]>;
} {
  const uncategorized: SkillOption[] = [];
  const groups: Record<string, SkillOption[]> = {};

  for (const node of nodes) {
    if (node.skill) {
      // Top-level skill without category → uncategorized
      uncategorized.push({
        value: node.skill,
        label: node.label,
        hint: node.hint,
      });
    } else if (node.children) {
      // Category node
      const groupName = node.label;
      groups[groupName] = [];
      addChildrenToGroup(node.children, groups[groupName], groups);
    }
  }

  return { uncategorized, groups };
}

/**
 * Recursively add children to groups, handling nested categories
 */
function addChildrenToGroup(
  children: TreeNode[],
  currentGroup: SkillOption[],
  allGroups: Record<string, SkillOption[]>
): void {
  for (const child of children) {
    if (child.skill) {
      currentGroup.push({
        value: child.skill,
        label: child.label,
        hint: child.hint,
      });
    } else if (child.children) {
      // Nested category - create new group
      const nestedGroupName = child.label;
      if (!allGroups[nestedGroupName]) {
        allGroups[nestedGroupName] = [];
      }
      addChildrenToGroup(child.children, allGroups[nestedGroupName], allGroups);
    }
  }
}

/**
 * Interactive tree selection using @clack/prompts multiselect or groupMultiselect
 * based on whether skills are categorized. Uses searchable prompts for large lists.
 */
export async function treeSelect(nodes: TreeNode[]): Promise<Skill[]> {
  // Check if stdin supports raw mode (required for interactive input)
  if (!process.stdin.isTTY) {
    throw new Error(
      "Interactive selection requires a TTY. Use -y flag for non-interactive mode."
    );
  }

  const { uncategorized, groups } = categorizeNodes(nodes);
  const hasGroups = Object.keys(groups).length > 0;
  const hasUncategorized = uncategorized.length > 0;
  const totalOptions = countTotalOptions(uncategorized, groups);
  const useSearch = totalOptions > SEARCH_THRESHOLD;

  // Case 1: Only uncategorized skills → use regular multiselect
  if (hasUncategorized && !hasGroups) {
    if (useSearch) {
      return searchableMultiselect(uncategorized);
    }

    const selected = await p.multiselect({
      message: "Select skills to install:",
      options: uncategorized,
      required: false,
    });

    if (p.isCancel(selected)) {
      throw new Error("Selection cancelled");
    }
    return selected as Skill[];
  }

  // Case 2: Only categorized skills → use groupMultiselect
  if (hasGroups && !hasUncategorized) {
    if (useSearch) {
      return searchableGroupMultiselect(groups);
    }

    const selected = await p.groupMultiselect({
      message: "Select skills to install:",
      options: groups,
      required: false,
    });

    if (p.isCancel(selected)) {
      throw new Error("Selection cancelled");
    }
    return selected as Skill[];
  }

  // Case 3: Mixed → use groupMultiselect with uncategorized in "Other" group
  if (hasGroups && hasUncategorized) {
    const mixedGroups = { ...groups };
    mixedGroups["Other"] = uncategorized;

    if (useSearch) {
      return searchableGroupMultiselect(mixedGroups);
    }

    const selected = await p.groupMultiselect({
      message: "Select skills to install:",
      options: mixedGroups,
      required: false,
    });

    if (p.isCancel(selected)) {
      throw new Error("Selection cancelled");
    }
    return selected as Skill[];
  }

  // No skills available
  p.log.warn("No skills available to select.");
  return [];
}

// Export for testing
export {
  categorizeNodes,
  addChildrenToGroup,
  filterOptions,
  highlightMatch,
  buildSearchableOptions,
  SEARCH_THRESHOLD,
};
