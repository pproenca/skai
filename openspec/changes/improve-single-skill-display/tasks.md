# Implementation Tasks

## 1. Core Display Logic
- [x] 1.1 Add `displaySingleSkill(skill: Skill)` helper function in `src/index.ts`
- [x] 1.2 Extract skill name and description for display
- [x] 1.3 Format category path if present (e.g., "api/validator") with `chalk.dim()`
- [x] 1.4 Use `clack.note()` with skill name as title

## 2. Styling (ux-color-semantics)
- [x] 2.1 Use `chalk.dim()` for category path (secondary info)
- [x] 2.2 Use `chalk.dim()` for "(No description provided)" hint
- [x] 2.3 Keep description text in regular styling (primary info)

## 3. Integration in Main Flow
- [x] 3.1 Call `displaySingleSkill()` after "Found 1 skill(s)" when `filteredSkills.length === 1`
- [x] 3.2 Ensure display happens before agent selection prompt
- [x] 3.3 Display skill info even in non-interactive mode (`-y`) for visibility
- [x] 3.4 Skip display entirely when `--json` flag is used (machine-readable output)

## 4. Edge Cases
- [x] 4.1 Handle missing description gracefully (show dimmed "(No description provided)")
- [x] 4.2 Handle skills with empty string description (treat as missing)
- [x] 4.3 Ensure list mode (`-l`) still works without duplicate display
- [x] 4.4 Handle skills without category (show only name and description)

## 5. Testing
- [ ] 5.1 Manual test: single skill source shows name/description
- [ ] 5.2 Manual test: single skill with category shows dimmed category path
- [ ] 5.3 Manual test: single skill without description shows dimmed hint
- [ ] 5.4 Manual test: multi-skill source uses tree-select (no change)
- [ ] 5.5 Manual test: `-y` flag still shows skill info
- [ ] 5.6 Manual test: `-l` flag doesn't duplicate skill info
- [ ] 5.7 Manual test: `--json` flag output unchanged (no note displayed)

## Definition of Done
- Single skill installations clearly show what's being installed
- Category and hints use dimmed styling per `ux-color-semantics`
- JSON mode remains machine-readable (no visual notes)
- No regression in multi-skill selection flow
- Matches existing TUI visual style (clack)
- All edge cases handled gracefully
