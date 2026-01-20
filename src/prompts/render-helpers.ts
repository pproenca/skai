/**
 * Shared rendering helpers for prompt classes.
 * Extracts common patterns from renderPrompt() methods.
 */
import color from "picocolors";
import { LAYOUT, S_BAR, S_BAR_END, symbol, getCheckboxSymbol } from "../ui-constants.js";
import { highlightMatch } from "./helpers.js";

/**
 * Render the prompt header (state symbol + message)
 */
export function renderHeader(state: string, message: string): string[] {
  return [
    `${color.gray(S_BAR)}`,
    `${symbol(state)}  ${message}`,
  ];
}

/**
 * Render the submit state (selected labels summary)
 */
export function renderSubmitState(selectedLabels: string[]): string[] {
  return [
    `${color.gray(S_BAR)}  ${color.dim(selectedLabels.join(", ") || "none")}`,
  ];
}

/**
 * Render the cancel state (strikethrough labels)
 */
export function renderCancelState(selectedLabels: string[]): string[] {
  const lines: string[] = [];
  if (selectedLabels.length > 0) {
    const strickenLabels = selectedLabels.map((label) =>
      color.strikethrough(color.dim(label))
    );
    lines.push(`${color.gray(S_BAR)}  ${strickenLabels.join(", ")}`);
  }
  lines.push(`${color.gray(S_BAR)}`);
  return lines;
}

/**
 * Render "N more above" indicator
 */
export function renderAboveIndicator(count: number): string[] {
  if (count <= 0) return [];
  return [
    `${color.cyan(S_BAR)}  ${color.dim(`↑ ${count} more above`)}`,
  ];
}

/**
 * Render "N more below" indicator
 */
export function renderBelowIndicator(count: number): string[] {
  if (count <= 0) return [];
  return [
    `${color.cyan(S_BAR)}`,
    `${color.cyan(S_BAR)}  ${color.dim(`↓ ${count} more below`)}`,
  ];
}

/**
 * Render the footer (bar end)
 */
export function renderFooter(): string[] {
  return [`${color.cyan(S_BAR_END)}`];
}

/**
 * Render "no results" message
 */
export function renderNoResults(searchTerm: string): string[] {
  return [
    `${color.cyan(S_BAR)}  ${color.dim(`No skills match "${searchTerm}"`)}`,
  ];
}

interface ItemRowOptions {
  label: string;
  hint?: string;
  isSelected: boolean;
  isActive: boolean;
  searchTerm?: string;
  indent?: string;
}

/**
 * Render an item row with checkbox, label, and hint.
 * Handles truncation, padding, highlighting, and active/inactive styling.
 */
export function renderItemRow(opts: ItemRowOptions): string {
  const { label, hint = "", isSelected, isActive, searchTerm, indent = "" } = opts;
  const checkbox = getCheckboxSymbol(isSelected, isActive);

  // Truncate and pad label to align summaries in a clean column
  const truncatedLabel =
    label.length > LAYOUT.LABEL_WIDTH
      ? label.slice(0, LAYOUT.LABEL_WIDTH - 1) + "…"
      : label;
  const paddedLabel = truncatedLabel.padEnd(LAYOUT.LABEL_WIDTH);

  // Apply highlight if searching
  const displayLabel =
    searchTerm && isActive
      ? highlightMatch(paddedLabel, searchTerm)
      : isActive
        ? paddedLabel
        : color.dim(paddedLabel);

  const displayHint = color.dim(hint);

  return `${color.cyan(S_BAR)}  ${indent}${checkbox} ${displayLabel} ${displayHint}`;
}

interface GroupRowOptions {
  groupName: string;
  selectedCount: number;
  totalCount: number;
  isAllSelected: boolean;
  isActive: boolean;
  searchTerm?: string;
}

/**
 * Render a group header row with checkbox and count
 */
export function renderGroupRow(opts: GroupRowOptions): string {
  const { groupName, selectedCount, totalCount, isAllSelected, isActive, searchTerm } = opts;
  const checkbox = getCheckboxSymbol(isAllSelected, isActive);

  const label = searchTerm && isActive
    ? highlightMatch(groupName, searchTerm)
    : isActive
      ? color.bold(groupName)
      : color.dim(groupName);

  const countHint =
    selectedCount > 0
      ? color.dim(` (${selectedCount}/${totalCount})`)
      : color.dim(` (${totalCount})`);

  return `${color.cyan(S_BAR)}  ${checkbox} ${label}${countHint}`;
}
