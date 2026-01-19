## ADDED Requirements

### Requirement: Skill Dependency Detection
The system SHALL detect npm dependencies declared in a skill's `package.json` file when a skill directory contains a valid `package.json` with a `dependencies` field.

#### Scenario: Skill with package.json
- **GIVEN** a skill directory containing SKILL.md and package.json
- **WHEN** the skill is installed
- **THEN** the system extracts the `dependencies` field from package.json
- **AND** associates those dependencies with the installed skill

#### Scenario: Skill without package.json
- **GIVEN** a skill directory containing only SKILL.md
- **WHEN** the skill is installed
- **THEN** the skill installs normally without dependency detection
- **AND** no dependency prompts are shown

#### Scenario: Malformed package.json
- **GIVEN** a skill directory with an invalid JSON package.json
- **WHEN** the skill is installed
- **THEN** the skill installs successfully
- **AND** a warning is shown about skipping dependencies
- **AND** the installation does not fail

### Requirement: Dependency Summary Display
The system SHALL display a summary of dependencies after installing skills that have npm dependencies, showing the skill name and its required packages with version constraints.

#### Scenario: Multiple skills with dependencies
- **GIVEN** 3 skills are being installed
- **AND** 2 of them have package.json with dependencies
- **WHEN** the skills finish installing
- **THEN** the system displays a summary showing:
  - Total skills installed
  - Which skills have dependencies
  - List of dependencies per skill (name@version)

#### Scenario: No skills have dependencies
- **GIVEN** 3 skills are being installed
- **AND** none have package.json
- **WHEN** the skills finish installing
- **THEN** no dependency summary is shown

### Requirement: Package Manager Detection
The system SHALL detect the user's preferred package manager by first checking the SKAI_PACKAGE_MANAGER environment variable, then checking for lockfiles in the current working directory, with pnpm as the default when neither is present.

#### Scenario: Environment variable override
- **GIVEN** the SKAI_PACKAGE_MANAGER environment variable is set to "yarn"
- **AND** the current directory contains pnpm-lock.yaml
- **WHEN** package manager detection runs
- **THEN** yarn is selected as the package manager (env var takes precedence)

#### Scenario: Project uses pnpm
- **GIVEN** no SKAI_PACKAGE_MANAGER env var is set
- **AND** the current directory contains pnpm-lock.yaml
- **WHEN** package manager detection runs
- **THEN** pnpm is selected as the package manager

#### Scenario: Project uses npm
- **GIVEN** no SKAI_PACKAGE_MANAGER env var is set
- **AND** the current directory contains package-lock.json
- **AND** no pnpm-lock.yaml exists
- **WHEN** package manager detection runs
- **THEN** npm is selected as the package manager

#### Scenario: Project uses yarn
- **GIVEN** no SKAI_PACKAGE_MANAGER env var is set
- **AND** the current directory contains yarn.lock
- **AND** no pnpm-lock.yaml or package-lock.json exists
- **WHEN** package manager detection runs
- **THEN** yarn is selected as the package manager

#### Scenario: Project uses bun
- **GIVEN** no SKAI_PACKAGE_MANAGER env var is set
- **AND** the current directory contains bun.lock
- **AND** no other lockfiles exist
- **WHEN** package manager detection runs
- **THEN** bun is selected as the package manager

#### Scenario: No lockfile present
- **GIVEN** no SKAI_PACKAGE_MANAGER env var is set
- **AND** the current directory has no package manager lockfile
- **WHEN** package manager detection runs
- **THEN** pnpm is selected as the default

### Requirement: Interactive Dependency Installation Prompt
The system SHALL prompt the user to install dependencies in interactive mode, offering the detected package manager as the recommended option with alternatives available.

#### Scenario: User accepts detected package manager
- **GIVEN** dependencies were detected
- **AND** pnpm is the detected package manager
- **AND** the user is in interactive mode (TTY and no -y flag)
- **WHEN** the dependency prompt appears
- **AND** user selects "Yes, install with pnpm"
- **THEN** dependencies are installed using pnpm

#### Scenario: User selects alternative package manager
- **GIVEN** dependencies were detected
- **AND** npm is the detected package manager
- **WHEN** the dependency prompt appears
- **AND** user selects "Yes, install with pnpm"
- **THEN** dependencies are installed using pnpm instead of npm

#### Scenario: User skips dependency installation
- **GIVEN** dependencies were detected
- **WHEN** the dependency prompt appears
- **AND** user selects "Skip"
- **THEN** no dependencies are installed
- **AND** a manual install command is shown using p.note()

### Requirement: Non-Interactive Dependency Installation
The system SHALL automatically install dependencies using the detected package manager when running with the `-y` (yes) flag, without prompting.

#### Scenario: Auto-install with -y flag
- **GIVEN** dependencies were detected
- **AND** pnpm is the detected package manager
- **AND** the -y flag was provided
- **WHEN** skill installation completes
- **THEN** dependencies are installed automatically with pnpm
- **AND** spinner progress is shown without prompts

### Requirement: Non-TTY Mode Behavior
The system SHALL automatically install dependencies without prompts when stdout is not a TTY (pipes, CI environments), using the detected package manager.

#### Scenario: CI environment without TTY
- **GIVEN** dependencies were detected
- **AND** stdout is not a TTY (piped output)
- **AND** no -y flag was provided
- **WHEN** skill installation completes
- **THEN** dependencies are installed automatically with detected package manager
- **AND** no interactive prompts are shown

#### Scenario: JSON output in non-TTY mode
- **GIVEN** the --json flag was provided
- **AND** dependencies were detected
- **WHEN** skill installation completes
- **THEN** output is JSON formatted with skills_installed, dependencies, and dependencies_installed fields

### Requirement: Dependency Conflict Detection
The system SHALL detect and warn about version conflicts between skill dependencies and existing project dependencies, allowing the user to proceed or skip.

#### Scenario: Version conflict detected
- **GIVEN** a skill requires "openai@^4.0.0"
- **AND** the project's package.json has "openai": "3.3.0"
- **WHEN** dependency installation is about to run
- **THEN** a warning is shown about the conflict
- **AND** user is prompted to proceed, skip, or cancel

#### Scenario: No conflicts
- **GIVEN** skill dependencies do not conflict with project dependencies
- **WHEN** dependency installation is about to run
- **THEN** no conflict warning is shown
- **AND** installation proceeds normally

### Requirement: Graceful Dependency Installation Failure
The system SHALL handle dependency installation failures gracefully without failing the overall skill installation, showing clear error messages and manual install hints.

#### Scenario: Package manager not installed
- **GIVEN** pnpm was selected
- **AND** pnpm is not installed on the system
- **WHEN** dependency installation is attempted
- **THEN** a clear error is shown with install instructions
- **AND** skill installation is marked as successful
- **AND** dependencies are marked as "not installed"
- **AND** manual install command is shown

#### Scenario: Network error during install
- **GIVEN** dependency installation is running
- **WHEN** a network error occurs
- **THEN** the error is shown to the user
- **AND** skill installation is marked as successful
- **AND** a manual install command is provided using p.note()

### Requirement: Dependency Installation Location
The system SHALL install skill dependencies to the current working directory's node_modules, not within the skill directory, to enable deduplication and bundler compatibility.

#### Scenario: Dependencies installed to project
- **GIVEN** skills with dependencies are installed to .claude/skills/
- **WHEN** dependency installation runs
- **THEN** npm packages are installed to ./node_modules/
- **AND** not to .claude/skills/skill-name/node_modules/

### Requirement: Progress Indicators During Dependency Operations
The system SHALL show spinner progress indicators during dependency scanning and installation operations to provide visual feedback that work is in progress.

#### Scenario: Scanning spinner
- **GIVEN** skills have been installed
- **WHEN** the system scans for dependencies
- **THEN** a spinner is shown with message "Scanning for dependencies..."
- **AND** when complete, spinner stops with "Found dependencies in N skills" or indicates none found

#### Scenario: Installation spinner
- **GIVEN** user has chosen to install dependencies
- **WHEN** the package manager is running
- **THEN** a spinner is shown with message "Installing dependencies with <pm> (N packages)..."
- **AND** when complete, spinner stops with "Dependencies installed" or error message

### Requirement: SIGINT Handling During Installation
The system SHALL handle SIGINT (Ctrl+C) during dependency installation by killing the subprocess and showing the manual install command.

#### Scenario: User cancels during installation
- **GIVEN** dependency installation is in progress
- **AND** the package manager subprocess is running
- **WHEN** user presses Ctrl+C
- **THEN** the subprocess is killed immediately
- **AND** the manual install command is shown using p.note()
- **AND** the process exits cleanly

### Requirement: Manual Install Command Display
The system SHALL display a copy-paste manual install command when dependencies are skipped or installation fails, using the p.note() format for clear visibility.

#### Scenario: Skip shows manual command
- **GIVEN** user selected "Skip" for dependency installation
- **WHEN** the prompt flow completes
- **THEN** a p.note() block is shown with the full install command
- **AND** the command includes all dependencies with version constraints

#### Scenario: Failure shows manual command
- **GIVEN** dependency installation failed
- **WHEN** the error is displayed
- **THEN** a p.note() block is shown with the full install command
- **AND** the user can copy and run it manually
