# Tasks: Add Skill Search to Multi-Select

## Implementation Order

### Phase 1: Core Search Prompt

- [x] 1. **Verify @clack/core terminal restoration**
   - Review @clack/core Prompt base class source
   - Confirm close() method restores raw mode and cursor
   - Test Ctrl+C signal handling and cleanup
   - Verify: Terminal state is always restored on exit/cancel/crash

- [x] 2. **Create SearchableMultiSelectPrompt class**
   - Extend `@clack/core` Prompt base class
   - Implement search state management (searchTerm, filteredOptions)
   - Handle keyboard input for search vs navigation
   - Verify: Class compiles and instantiates without errors

- [x] 3. **Implement filtering logic with search optimization**
   - Pre-compute lowercase searchable text at option creation
   - Add case-insensitive substring matching
   - Match against pre-computed text (name|category|description)
   - Filter options while preserving original order
   - Verify: Unit tests for filter function with various inputs

- [x] 4. **Implement render method (batched output)**
   - Return single batched string (render-single-write)
   - Display search input with cursor
   - Show filtered options list with selection indicators
   - Display match count ("N of M skills")
   - Show "No matches" message for empty results
   - Verify: Manual testing, no visual flicker

- [x] 5. **Handle selection persistence**
   - Track selected values separately from visible options
   - Preserve selections when filter changes
   - Sync selected state when filter clears
   - Verify: Select items, filter, verify selections persist

### Phase 2: Keyboard Handling

- [x] 6. **Implement navigation keys**
   - Up/Down arrows for list navigation
   - Space for toggle selection
   - Enter for submit
   - Verify: All navigation keys work as expected

- [x] 7. **Implement search keys**
   - Alphanumeric input appends to search
   - Backspace removes last character (via @clack/core)
   - Escape clears search (or cancels if empty)
   - Ctrl+C cancels immediately
   - Verify: Search input behaves naturally

### Phase 3: Integration

- [x] 8. **Create SearchableGroupMultiSelectPrompt**
   - Extend same pattern for grouped options
   - Filter groups and their children
   - Hide empty groups after filtering
   - Verify: Grouped filtering works correctly

- [x] 9. **Update treeSelect function**
   - Replace direct clack.multiselect/groupMultiselect calls
   - Add threshold check (only search if > 5 skills)
   - Maintain existing API signature
   - Verify: Existing tests still pass

- [x] 10. **Add TTY fallback**
    - Detect non-TTY environment
    - Fall back to standard multiselect without search
    - Verify: Works in piped/non-interactive contexts

### Phase 4: Polish

- [x] 11. **Add visual enhancements**
    - Highlight matched portions of text in cyan (ux-color-semantics)
    - Add scroll indicators for long lists (↑ N more above / ↓ N more below)
    - Style search input consistently with clack theme
    - Verify: Visual consistency with existing prompts

- [x] 12. **Write unit tests**
    - Test filter logic edge cases
    - Test selection persistence
    - Test keyboard handling
    - Test scroll behavior with maxItems
    - Verify: Coverage for new code paths

- [x] 13. **Manual E2E testing**
    - Test with small skill sets (< threshold)
    - Test with large skill sets (> threshold, 100+ items)
    - Test with grouped skills
    - Test non-TTY fallback
    - Test Ctrl+C and terminal restoration
    - Verify: All scenarios work end-to-end

## Dependencies

- Task 1 is independent (verification only)
- Task 2 can start after Task 1 verification
- Task 3 depends on Task 2 (need class to add filter logic)
- Task 4 depends on Task 3 (render needs filtered data)
- Tasks 6-7 depend on Task 2 (keyboard handling in prompt class)
- Task 8 depends on Tasks 2-7 (builds on flat implementation)
- Task 9 depends on Tasks 2-8 (integration requires complete prompts)
- Task 10 depends on Task 9 (fallback logic in treeSelect)
- Tasks 11-13 can run in parallel after Task 10

## Parallelizable Work

- Task 1 (verification) can run in parallel with early exploration
- After Phase 1, Tasks 6-7 can run in parallel with Task 8 prep work
