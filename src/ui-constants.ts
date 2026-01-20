import color from "picocolors";

/**
 * Spacing tokens for consistent TUI layout
 */
export const SPACING = {
  /** Standard content indent after bar (2 spaces) */
  CONTENT_INDENT: "  ",
  /** Space between checkbox and label */
  CHECKBOX_GAP: " ",
  /** Space between tabs */
  TAB_GAP: "  ",
} as const;

/**
 * Layout dimensions for consistent sizing
 */
export const LAYOUT = {
  /** Tab bar and separator width */
  TAB_BAR_WIDTH: 50,
  /** Separator line width (matches tab bar) */
  SEPARATOR_WIDTH: 50,
  /** Max visible items in scrollable lists */
  MAX_VISIBLE_ITEMS: 10,
  /** Skill name column width */
  NAME_WIDTH: 25,
  /** Agent column width */
  AGENT_WIDTH: 14,
  /** Label/description column width */
  LABEL_WIDTH: 30,
} as const;

/**
 * Step indicator symbols (prompt state)
 */
export const S_STEP_ACTIVE = color.green("◆");
export const S_STEP_CANCEL = color.red("■");
export const S_STEP_SUBMIT = color.green("◇");

/**
 * Bar symbols for prompt structure
 */
export const S_BAR = color.gray("│");
export const S_BAR_END = color.gray("└");

/**
 * Checkbox symbols for multi-select
 */
export const S_CHECKBOX_ACTIVE = color.cyan("◻");
export const S_CHECKBOX_SELECTED = color.green("◼");
export const S_CHECKBOX_INACTIVE = color.dim("◻");

/**
 * Toggle symbols for skill manager (enable/disable states)
 */
export const S_TOGGLE_ENABLED = color.green("◼");
export const S_TOGGLE_DISABLED = color.dim("◻");
export const S_TOGGLE_PENDING_DISABLE = color.red("◻");
export const S_TOGGLE_PENDING_ENABLE = color.green("◼");
export const S_TOGGLE_ACTIVE = color.cyan("◻");
export const S_TOGGLE_ACTIVE_ENABLED = color.green("◼");

/**
 * Search box symbols (rounded corners)
 */
export const S_BOX_TOP_LEFT = "╭";
export const S_BOX_TOP_RIGHT = "╮";
export const S_BOX_BOTTOM_LEFT = "╰";
export const S_BOX_BOTTOM_RIGHT = "╯";
export const S_BOX_HORIZONTAL = "─";
export const S_BOX_VERTICAL = "│";
export const S_SEARCH_ICON = "⌕";

/**
 * Helper to create a separator line
 */
export function createSeparator(width: number = LAYOUT.SEPARATOR_WIDTH): string {
  return color.dim("─".repeat(width));
}

/**
 * Helper to get prompt state symbol
 */
export function symbol(state: string): string {
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

/**
 * Get the appropriate checkbox symbol based on selection and active state
 * Consolidates duplicate checkbox rendering logic from tree-select.ts
 */
export function getCheckboxSymbol(isSelected: boolean, isActive: boolean): string {
  if (isSelected) {
    return S_CHECKBOX_SELECTED;
  }
  if (isActive) {
    return S_CHECKBOX_ACTIVE;
  }
  return S_CHECKBOX_INACTIVE;
}
