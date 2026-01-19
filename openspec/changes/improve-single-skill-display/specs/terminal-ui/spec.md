# Terminal UI Specification

## ADDED Requirements

### Requirement: Single Skill Information Display
When a source contains exactly one skill, the system SHALL display the skill's details (name and description) before prompting for agent selection or installation scope.

#### Scenario: Single skill with description
- **WHEN** user runs `skai <source>` on a source with exactly one skill
- **AND** the skill has a description in its SKILL.md frontmatter
- **THEN** display a note box showing the skill name as title and description as body
- **AND** continue to agent selection prompt

#### Scenario: Single skill without description
- **WHEN** user runs `skai <source>` on a source with exactly one skill
- **AND** the skill has no description or empty description
- **THEN** display a note box showing the skill name as title
- **AND** show "(No description provided)" in dimmed text as the body
- **AND** continue to agent selection prompt

#### Scenario: Single skill with category
- **WHEN** user runs `skai <source>` on a source with exactly one skill
- **AND** the skill has a category path (e.g., "api/validator")
- **THEN** display the category path in dimmed text in the note body before the description

#### Scenario: Single skill in non-interactive mode
- **WHEN** user runs `skai <source> -y` on a source with exactly one skill
- **THEN** still display the skill's details for visibility
- **AND** proceed with installation without prompts

#### Scenario: Single skill in JSON mode
- **WHEN** user runs `skai <source> --json` on a source with exactly one skill
- **THEN** do not display the skill note box
- **AND** output machine-readable JSON only

#### Scenario: Multiple skills unchanged
- **WHEN** user runs `skai <source>` on a source with more than one skill
- **THEN** use the existing tree-select interface
- **AND** do not display individual skill notes

#### Scenario: List mode unchanged
- **WHEN** user runs `skai <source> -l` (list mode)
- **THEN** use the existing tree display format
- **AND** do not show individual skill note boxes

### Requirement: Semantic Color Usage for Skill Display
The skill display SHALL use semantic colors per TUI best practices (`ux-color-semantics`).

#### Scenario: Category path styling
- **WHEN** displaying a skill with a category path
- **THEN** render the category path with dimmed styling (secondary information)

#### Scenario: Missing description hint styling
- **WHEN** displaying a skill without a description
- **THEN** render "(No description provided)" with dimmed styling (hint text)

#### Scenario: Description styling
- **WHEN** displaying a skill with a description
- **THEN** render the description in regular styling (primary information)
