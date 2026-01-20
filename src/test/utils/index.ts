export { MockInputStream, KEY_CODES } from "./mock-input-stream.js";
export { MockOutputStream, stripAnsi } from "./mock-output-stream.js";
export { KeySequence, keys } from "./key-sequence.js";
export { PromptTestHarness, createTestHarness } from "./prompt-test-harness.js";

// Snapshot utilities
export {
  normalizeSnapshot,
  normalizeWhitespace,
  extractSection,
  diffSnapshots,
  createSnapshotMatcher,
  formatSnapshot,
  type SnapshotOptions,
} from "./snapshot-helpers.js";

// Test data generators
export {
  createSkill,
  createSkillOption,
  createSearchableOption,
  createSkillNode,
  createCategoryNode,
  generateSkills,
  generateSearchableOptions,
  generateSkillOptions,
  generateSkillGroups,
  generateTreeNodes,
  createLongNameSkill,
  createUnicodeSkill,
  createSpecialCharacterSkill,
  createManagedSkill,
  generateManagedSkills,
  createRealisticSkillSet,
  createRealisticSearchableOptions,
  type SkillGeneratorOptions,
  type ManagedSkillGeneratorOptions,
} from "./test-data-generators.js";
