# Skill Search Capability

## ADDED Requirements

### Requirement: Search input for skill filtering

The system SHALL display an interactive search input that filters the skill list in real-time when skill selection displays more than 5 options.

#### Scenario: Search input appears for large skill lists

**Given** a source with 10 skills
**When** the skill selection prompt is displayed
**Then** a search input field appears above the skill list
**And** the search shows "Search: _" with a cursor
**And** a match count displays "(10 skills)"

#### Scenario: Search input hidden for small skill lists

**Given** a source with 4 skills
**When** the skill selection prompt is displayed
**Then** no search input field appears
**And** the standard multiselect behavior is used

### Requirement: Real-time filtering by search term

The system SHALL immediately filter the skill list to show only matching options when the user types in the search field.

#### Scenario: Filter matches skill name

**Given** the skill selection prompt with search enabled
**And** skills named "react-hooks", "vue-components", "react-query"
**When** the user types "react"
**Then** only "react-hooks" and "react-query" are visible
**And** the match count shows "(2 of 3 skills)"

#### Scenario: Filter matches category path

**Given** the skill selection prompt with search enabled
**And** skills in categories "coding/frontend" and "coding/backend"
**When** the user types "frontend"
**Then** only skills in "coding/frontend" category are visible

#### Scenario: Filter matches description

**Given** the skill selection prompt with search enabled
**And** a skill with description "API validation using zod"
**When** the user types "zod"
**Then** that skill is visible in the filtered list

#### Scenario: Case-insensitive matching

**Given** the skill selection prompt with search enabled
**And** a skill named "TypeScript"
**When** the user types "typescript"
**Then** the "TypeScript" skill is visible

#### Scenario: Empty filter results

**Given** the skill selection prompt with search enabled
**When** the user types "xyz123nonexistent"
**Then** no skills are visible
**And** a message shows "No skills match \"xyz123nonexistent\""
**And** the match count shows "(0 of N skills)"

#### Scenario: Matched text is highlighted

**Given** the skill selection prompt with search enabled
**And** a skill named "react-hooks"
**When** the user types "react"
**Then** the "react" portion of "react-hooks" is highlighted in cyan

### Requirement: Selection persistence across filter changes

The system SHALL preserve selections made before or during filtering even when the selected skills are filtered out of view.

#### Scenario: Selection persists when filtered out

**Given** the skill selection prompt with search enabled
**And** the user has selected "react-hooks"
**When** the user types "vue" (filtering out react-hooks)
**And** then clears the search
**Then** "react-hooks" remains selected

#### Scenario: Selection persists when filter refines

**Given** the skill selection prompt with search enabled
**And** the user selects "react-hooks" while filtering for "react"
**When** the user types "query" (changing filter to match different skills)
**And** then clears the search
**Then** "react-hooks" remains selected

### Requirement: Keyboard navigation with search

The system SHALL support keyboard shortcuts for search, navigation, and selection.

#### Scenario: Typing adds to search

**Given** the skill selection prompt with search enabled
**When** the user types alphanumeric characters
**Then** each character is appended to the search term
**And** the filter updates immediately

#### Scenario: Backspace removes from search

**Given** the skill selection prompt with search term "react"
**When** the user presses Backspace
**Then** the search term becomes "reac"
**And** the filter updates immediately

#### Scenario: Escape clears search

**Given** the skill selection prompt with search term "react"
**When** the user presses Escape
**Then** the search term becomes empty
**And** all skills become visible

#### Scenario: Escape cancels when search empty

**Given** the skill selection prompt with empty search term
**When** the user presses Escape
**Then** the selection is cancelled

#### Scenario: Arrow keys navigate filtered list

**Given** the skill selection prompt with filtered results
**When** the user presses Down arrow
**Then** the cursor moves to the next visible skill

#### Scenario: Space toggles selection

**Given** the skill selection prompt with cursor on a skill
**When** the user presses Space
**Then** the skill's selection state is toggled

#### Scenario: Enter confirms selection

**Given** the skill selection prompt with selected skills
**When** the user presses Enter
**Then** the prompt returns the selected skills

#### Scenario: Ctrl+C cancels immediately

**Given** the skill selection prompt with any search state
**When** the user presses Ctrl+C
**Then** the selection is cancelled immediately
**And** terminal state is restored to normal

### Requirement: TTY fallback for non-interactive environments

The system SHALL fall back to standard multiselect without search in non-TTY environments.

#### Scenario: Non-TTY uses standard prompt

**Given** the process stdin is not a TTY (piped input)
**And** a source with 10 skills
**When** the skill selection prompt is displayed
**Then** the standard multiselect without search is used

### Requirement: Scrolling for long lists

The system SHALL limit visible options to a maximum count and provide scroll indicators when the filtered list exceeds this limit.

#### Scenario: Long list shows scroll indicators

**Given** the skill selection prompt with search enabled
**And** 100 skills available
**When** the user types "test" matching 25 skills
**And** maxItems is set to 10
**Then** only 10 skills are visible at once
**And** scroll indicators show remaining items above and below

#### Scenario: Arrow navigation scrolls viewport

**Given** the skill selection prompt showing 10 of 25 filtered skills
**And** the cursor is at the last visible item
**When** the user presses Down arrow
**Then** the viewport scrolls down to reveal the next skill

### Requirement: Grouped skills search

The system SHALL filter both group names and individual skills when skills are organized in categories.

#### Scenario: Filter by group name shows all group skills

**Given** the skill selection prompt with grouped skills
**And** a group named "Frontend" containing 3 skills
**When** the user types "Frontend"
**Then** all 3 skills in the "Frontend" group are visible

#### Scenario: Empty groups are hidden

**Given** the skill selection prompt with grouped skills
**And** groups "Frontend" and "Backend"
**When** the user types "react" (matching only Frontend skills)
**Then** the "Backend" group header is not visible
