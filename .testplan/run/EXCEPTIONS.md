# Coverage Exceptions

This document justifies code that is intentionally not covered by tests.

## Excluded Files (from vitest.config.js)

These files are excluded from coverage and do not need test coverage:

### `src/index.ts` - CLI Entry Point
- **Coverage**: Excluded
- **Justification**: CLI entry point requires integration testing, not unit testing
- **Evidence**: Excluded in `vitest.config.js` coverage configuration
- **Risk Assessment**: Low - CLI behavior tested via integration tests

### `src/lib/tui.ts` - Terminal User Interface
- **Coverage**: Excluded
- **Justification**: TUI requires TTY and is difficult to test in CI
- **Evidence**: Excluded in `vitest.config.js` coverage configuration
- **Risk Assessment**: Low - TUI is primarily visual and tested manually

### `src/lib/tuiProgressTracker.ts` - TUI Progress Tracker
- **Coverage**: Excluded
- **Justification**: TUI tracker requires TTY and is difficult to test in CI
- **Evidence**: Excluded in `vitest.config.js` coverage configuration
- **Risk Assessment**: Low - TUI tracker is primarily visual and tested manually

## Unreachable Code

(To be populated if any unreachable code is identified after test fixes and coverage generation)

## Not Worth Testing

(To be populated if any code is identified as not worth the risk/cost of testing)

