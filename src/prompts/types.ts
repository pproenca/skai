import type { Skill, TreeNode } from "../types.js";

export interface FlatNode {
  node: TreeNode;
  depth: number;
  parentId?: string;
}

export type SkillOption = { value: Skill; label: string; hint?: string };

export interface SearchableOption<T> {
  option: SkillOption;
  searchableText: string;
  value: T;
}

export interface SearchableGroupOption<T> {
  option: SkillOption;
  searchableText: string;
  value: T;
  group: string;
}

export interface GroupedSearchableOptions<T> {
  groupName: string;
  options: SearchableGroupOption<T>[];
  searchableText: string;
}

export type FlatGroupItem<T> =
  | { type: "group"; name: string; searchable: string }
  | { type: "option"; option: SearchableGroupOption<T>; groupName: string };

// Constants
export const SEARCH_THRESHOLD = 5;
export const MAX_SEARCH_LENGTH = 50;
