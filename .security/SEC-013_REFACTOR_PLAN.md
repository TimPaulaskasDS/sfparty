# SEC-013: Global State Management Refactoring Plan

**Issue ID**: SEC-013  
**Priority**: Medium (Code Quality / Architecture)  
**Effort**: 1-2 weeks  
**Status**: Planned Refactoring  
**Date**: January 2026

---

## Executive Summary

This document outlines the plan to refactor global state management in the `sfparty` codebase from a global object pattern to dependency injection. This is a **code quality and architecture improvement** that will reduce potential race conditions, improve testability, and make the codebase more maintainable.

**Current State**: 209 global state usages across 9 files  
**Target State**: Dependency injection with context objects  
**Risk**: Medium (refactoring risk, but current implementation works)

---

## What Is The Problem?

### Current Architecture

The codebase currently uses Node.js global scope to share state across modules:

```typescript
// Global state defined in src/index.ts
interface GlobalContext {
  __basedir?: string
  logger?: Logger
  displayError?: (message: string, quit?: boolean) => void
  format?: string
  metaTypes?: Record<string, MetaTypeEntry>
  git?: GitConfig
  signConfig?: boolean
  verifyConfig?: boolean
  process?: ProcessedStats
  // ... more properties
}

declare const global: GlobalContext & typeof globalThis
```

**Usage Pattern** (209 instances across 9 files):
```typescript
// src/lib/fileUtils.ts
global.logger?.error('Error message')

// src/party/split.ts
const basedir = global.__basedir

// src/index.ts
global.format = argv.format
```

### Why This Is A Problem

1. **Testability Issues**:
   - Tests must mock global state, which is fragile
   - Global state persists between tests unless carefully reset
   - Difficult to test concurrent scenarios
   - Hard to isolate test cases

2. **Race Condition Risk**:
   - Multiple operations could modify global state simultaneously
   - No clear ownership of state
   - State mutations are implicit and hard to track

3. **Maintainability**:
   - Hidden dependencies (functions depend on global state implicitly)
   - Hard to understand data flow
   - Difficult to refactor individual modules
   - Global state makes functions impure

4. **Security Concerns**:
   - Potential for state leakage between operations
   - Hard to verify state isolation
   - Could lead to information disclosure if state is shared incorrectly

5. **Code Quality**:
   - Violates dependency inversion principle
   - Makes code harder to reason about
   - Reduces modularity

---

## Why Is This Important?

### Security Benefits

1. **State Isolation**: Prevents accidental state sharing between operations
2. **Explicit Dependencies**: Makes security-critical dependencies visible
3. **Testability**: Enables proper security testing of isolated components
4. **Audit Trail**: Clear data flow makes security reviews easier

### Code Quality Benefits

1. **Better Testing**: Functions become pure and testable in isolation
2. **Easier Refactoring**: Modules become independent
3. **Clearer Dependencies**: Function signatures show what's needed
4. **Better IDE Support**: TypeScript can track dependencies properly
5. **Reduced Coupling**: Modules don't depend on global initialization order

### Long-Term Benefits

1. **Easier to Add Features**: New features don't need to understand global state
2. **Better Documentation**: Function signatures document dependencies
3. **Team Collaboration**: Easier for multiple developers to work on codebase
4. **Future-Proofing**: Prepares codebase for potential multi-threading or async improvements

---

## Current State Analysis

### Global State Usage Statistics

- **Total Global References**: 209 across 9 files
- **Files Affected**: 
  - `src/index.ts`: 88 references
  - `src/lib/fileUtils.ts`: 11 references
  - `src/lib/packageUtil.ts`: 5 references
  - `src/lib/auditLogger.ts`: 14 references
  - `src/party/combine.ts`: 47 references
  - `src/party/split.ts`: 29 references
  - `src/lib/errorUtils.ts`: 2 references
  - `src/lib/tuiProgressTracker.ts`: 10 references
  - `src/lib/checkVersion.ts`: 3 references

### Global State Properties

1. **`global.__basedir`**: Project root directory (read-only after init)
2. **`global.logger`**: Winston logger instance (read-only after init)
3. **`global.displayError`**: Error display function (read-only after init)
4. **`global.format`**: Output format (yaml/json) (set per operation)
5. **`global.metaTypes`**: Metadata type registry (read-only after init)
6. **`global.git`**: Git configuration (set per operation)
7. **`global.signConfig`**: Signing flag (set per operation)
8. **`global.verifyConfig`**: Verification flag (set per operation)
9. **`global.process`**: Processing statistics (mutable during operation)
10. **`global.icons`**: UI icons (read-only after init)
11. **`global.consoleTransport`**: Logger transport control (read-only after init)
12. **`global.runType`**: Execution context (read-only after init)

### Function Signature Impact

- **Total Exported Functions**: 87 across 22 files
- **Functions Needing Updates**: ~50-60 (those that use global state)
- **Test Files**: 45 test files that may need updates

---

## Proposed Solution: Dependency Injection Pattern

### Architecture Design

Replace global state with explicit context objects passed as function parameters:

```typescript
// NEW: Context interface
interface AppContext {
  basedir: string
  logger: Logger
  displayError: (message: string, quit?: boolean) => void
  format: string
  metaTypes: Record<string, MetaTypeEntry>
  git?: GitConfig
  signConfig: boolean
  verifyConfig: boolean
  process?: ProcessedStats
  icons: Icons
  consoleTransport: winston.transports.ConsoleTransportInstance
  runType: string | null
}

// NEW: Context factory
function createContext(options: Partial<AppContext>): AppContext {
  // Initialize with defaults and provided options
}

// OLD: Global state usage
function processFile(file: string) {
  global.logger?.error('Error')
  const basedir = global.__basedir
}

// NEW: Explicit context
function processFile(ctx: AppContext, file: string) {
  ctx.logger.error('Error')
  const basedir = ctx.basedir
}
```

### Migration Strategy

**Phase 1: Create Context Infrastructure** (Day 1-2)
1. Define `AppContext` interface
2. Create context factory function
3. Create context builder utilities
4. Add context to `GlobalContext` interface (temporary bridge)

**Phase 2: Migrate Core Utilities** (Day 3-5)
1. Start with `src/lib/fileUtils.ts` (11 references)
2. Update function signatures to accept `ctx: AppContext`
3. Replace global references with context
4. Update callers to pass context
5. Update tests

**Phase 3: Migrate Business Logic** (Day 6-8)
1. Migrate `src/party/split.ts` (29 references)
2. Migrate `src/party/combine.ts` (47 references)
3. Update `src/index.ts` handlers to create and pass context
4. Update tests

**Phase 4: Migrate Remaining Modules** (Day 9-10)
1. Migrate `src/lib/packageUtil.ts`
2. Migrate `src/lib/auditLogger.ts`
3. Migrate `src/lib/tuiProgressTracker.ts`
4. Migrate remaining files
5. Update all tests

**Phase 5: Cleanup** (Day 11-12)
1. Remove global state declarations
2. Remove `GlobalContext` interface
3. Update documentation
4. Final test suite run
5. Code review

---

## Implementation Guidelines

### 1. Function Signature Updates

**Before**:
```typescript
export async function readFile(
  filePath: string,
  convert = true,
  fsTmp: typeof fs = fs,
): Promise<unknown> {
  global.logger?.error('Error')
  const basedir = global.__basedir
}
```

**After**:
```typescript
export async function readFile(
  ctx: AppContext,
  filePath: string,
  convert = true,
  fsTmp: typeof fs = fs,
): Promise<unknown> {
  ctx.logger.error('Error')
  const basedir = ctx.basedir
}
```

### 2. Context Creation

**In Handlers**:
```typescript
function splitHandler(argv: SplitCombineArgv, startTime: bigint): void {
  // Create context from argv and global state
  const ctx = createContext({
    basedir: global.__basedir!,
    logger: global.logger!,
    displayError: global.displayError!,
    format: argv.format,
    metaTypes: global.metaTypes!,
    signConfig: argv.signConfig ?? false,
    verifyConfig: argv.verifyConfig ?? false,
    icons: global.icons!,
    consoleTransport: global.consoleTransport!,
    runType: global.runType ?? null,
  })
  
  // Pass context to functions
  processSplit(ctx, types[0], argv)
}
```

### 3. Context Propagation

**Call Chain Example**:
```typescript
// Entry point
splitHandler(argv) 
  → processSplit(ctx, type, argv)
    → new Split(ctx, ...)
      → split.split()
        → fileUtils.readFile(ctx, filePath)
```

### 4. Optional Context (Backward Compatibility)

For functions that might not need full context:
```typescript
interface MinimalContext {
  logger?: Logger
  basedir?: string
}

function utilityFunction(
  ctx: MinimalContext,
  // ... other params
) {
  ctx.logger?.error('Error') // Optional chaining for optional properties
}
```

---

## Testing Strategy

### Test Preservation Requirements

**CRITICAL**: All 868 existing tests must continue to pass. This is non-negotiable.

### Test Update Pattern

**Before**:
```typescript
describe('readFile', () => {
  beforeEach(() => {
    global.logger = mockLogger
    global.__basedir = '/test'
  })
  
  it('should read file', async () => {
    const result = await readFile('/test/file.yaml')
    expect(result).toBeDefined()
  })
})
```

**After**:
```typescript
describe('readFile', () => {
  let ctx: AppContext
  
  beforeEach(() => {
    ctx = createContext({
      logger: mockLogger,
      basedir: '/test',
      // ... other required properties
    })
  })
  
  it('should read file', async () => {
    const result = await readFile(ctx, '/test/file.yaml')
    expect(result).toBeDefined()
  })
})
```

### Test Helper Functions

Create test utilities to simplify context creation:

```typescript
// test/helpers/context.ts
export function createTestContext(
  overrides: Partial<AppContext> = {}
): AppContext {
  return createContext({
    basedir: '/test',
    logger: createMockLogger(),
    displayError: vi.fn(),
    format: 'yaml',
    metaTypes: {},
    signConfig: false,
    verifyConfig: false,
    icons: createMockIcons(),
    consoleTransport: createMockTransport(),
    runType: 'test',
    ...overrides,
  })
}
```

### Migration Testing Strategy

1. **Incremental Updates**: Update one module at a time
2. **Test After Each Module**: Run full test suite after each module migration
3. **Preserve Test Logic**: Don't change test assertions, only update context setup
4. **Add Integration Tests**: Add tests that verify context propagation works correctly

### Test Coverage Requirements

- Maintain 80%+ coverage for all files
- Add tests for context creation and validation
- Test context propagation through call chains
- Test error handling when context is missing

---

## Risk Mitigation

### 1. Breaking Changes

**Risk**: Function signature changes break existing code  
**Mitigation**: 
- Update all callers in same commit as function signature change
- Use TypeScript compiler to catch missing updates
- Run full test suite after each change

### 2. Test Failures

**Risk**: Tests fail due to context setup issues  
**Mitigation**:
- Create comprehensive test helpers
- Update tests incrementally
- Preserve all test logic and assertions
- Add context validation in test helpers

### 3. Performance Impact

**Risk**: Passing context adds overhead  
**Mitigation**:
- Context objects are lightweight (just references)
- No significant performance impact expected
- Benchmark before/after if concerned

### 4. Incomplete Migration

**Risk**: Some global state remains  
**Mitigation**:
- Use grep to find all `global.` references
- Add linting rule to prevent new global usage
- Code review checklist

### 5. Context Propagation Errors

**Risk**: Context not passed correctly through call chains  
**Mitigation**:
- TypeScript will catch missing parameters
- Add runtime validation in development mode
- Integration tests verify context flow

---

## Success Criteria

### Functional Requirements

- [ ] All 868 existing tests pass
- [ ] All functionality works identically to before
- [ ] No performance regression
- [ ] Code compiles without errors
- [ ] No new linting errors

### Code Quality Requirements

- [ ] Zero `global.` references in source code (except context creation)
- [ ] All functions that need context have it in signature
- [ ] Context is passed explicitly through all call chains
- [ ] Test helpers make test updates easy
- [ ] Documentation updated

### Security Requirements

- [ ] State isolation verified (no cross-operation leakage)
- [ ] Security tests still pass
- [ ] No new security vulnerabilities introduced

---

## Rollback Plan

If issues arise during migration:

1. **Immediate Rollback**: Revert to previous commit
2. **Partial Rollback**: Keep completed modules, revert problematic ones
3. **Incremental Fix**: Fix issues in small commits
4. **Test Verification**: Run full test suite after each fix

---

## Implementation Checklist

### Phase 1: Infrastructure (Days 1-2)
- [ ] Create `AppContext` interface in `src/types/context.ts`
- [ ] Create `createContext()` factory function
- [ ] Create test helper `createTestContext()`
- [ ] Add context to `GlobalContext` as bridge
- [ ] Write tests for context creation
- [ ] Update documentation

### Phase 2: Core Utilities (Days 3-5)
- [ ] Migrate `src/lib/fileUtils.ts` (11 references)
- [ ] Update all callers of `fileUtils` functions
- [ ] Update all tests for `fileUtils`
- [ ] Verify all tests pass
- [ ] Commit changes

### Phase 3: Business Logic (Days 6-8)
- [ ] Migrate `src/party/split.ts` (29 references)
- [ ] Migrate `src/party/combine.ts` (47 references)
- [ ] Update `src/index.ts` handlers
- [ ] Update all tests
- [ ] Verify all tests pass
- [ ] Commit changes

### Phase 4: Remaining Modules (Days 9-10)
- [ ] Migrate `src/lib/packageUtil.ts` (5 references)
- [ ] Migrate `src/lib/auditLogger.ts` (14 references)
- [ ] Migrate `src/lib/tuiProgressTracker.ts` (10 references)
- [ ] Migrate `src/lib/checkVersion.ts` (3 references)
- [ ] Migrate `src/lib/errorUtils.ts` (2 references)
- [ ] Update all tests
- [ ] Verify all tests pass
- [ ] Commit changes

### Phase 5: Cleanup (Days 11-12)
- [ ] Remove `GlobalContext` interface
- [ ] Remove global state declarations
- [ ] Add linting rule to prevent `global.` usage
- [ ] Update all documentation
- [ ] Final test suite run (all 868 tests)
- [ ] Code review
- [ ] Update `SECURITY_TRIAGE.md` to mark SEC-013 as resolved

---

## Code Examples

### Example 1: Simple Function Migration

**Before** (`src/lib/fileUtils.ts`):
```typescript
export async function readFile(
  filePath: string,
  convert = true,
  fsTmp: typeof fs = fs,
): Promise<unknown> {
  try {
    if (global.__basedir) {
      validatedPath = validatePath(filePath, global.__basedir)
    }
    // ...
    global.logger?.error(error)
  } catch (error) {
    handleFileError(error, global.logger)
  }
}
```

**After**:
```typescript
export async function readFile(
  ctx: AppContext,
  filePath: string,
  convert = true,
  fsTmp: typeof fs = fs,
): Promise<unknown> {
  try {
    if (ctx.basedir) {
      validatedPath = validatePath(filePath, ctx.basedir)
    }
    // ...
    ctx.logger.error(error)
  } catch (error) {
    handleFileError(error, ctx.logger)
  }
}
```

### Example 2: Class Migration

**Before** (`src/party/split.ts`):
```typescript
export class Split {
  async split(): Promise<boolean> {
    const basedir = global.__basedir
    global.logger?.error('Error')
    // ...
  }
}
```

**After**:
```typescript
export class Split {
  constructor(private ctx: AppContext) {}
  
  async split(): Promise<boolean> {
    const basedir = this.ctx.basedir
    this.ctx.logger.error('Error')
    // ...
  }
}
```

### Example 3: Handler Migration

**Before** (`src/index.ts`):
```typescript
function splitHandler(argv: SplitCombineArgv, startTime: bigint): void {
  global.format = argv.format
  global.signConfig = argv.signConfig ?? false
  const split = processSplit(types[0], argv)
}
```

**After**:
```typescript
function splitHandler(argv: SplitCombineArgv, startTime: bigint): void {
  const ctx = createContext({
    basedir: global.__basedir!,
    logger: global.logger!,
    displayError: global.displayError!,
    format: argv.format,
    metaTypes: global.metaTypes!,
    signConfig: argv.signConfig ?? false,
    verifyConfig: argv.verifyConfig ?? false,
    icons: global.icons!,
    consoleTransport: global.consoleTransport!,
    runType: global.runType ?? null,
  })
  
  const split = processSplit(ctx, types[0], argv)
}
```

---

## Notes for Implementation

1. **Start Small**: Begin with `fileUtils.ts` as it's well-tested and isolated
2. **One Module at a Time**: Complete each module fully before moving to next
3. **Test Frequently**: Run full test suite after each module
4. **Preserve Behavior**: Don't change logic, only how dependencies are accessed
5. **Type Safety**: Let TypeScript guide you - it will catch missing context
6. **Documentation**: Update JSDoc comments to document context requirements
7. **Code Review**: Get review after each phase before proceeding

---

## Questions to Answer During Implementation

1. Should context be required or optional for all functions?
2. Should we have different context types (e.g., `ReadContext`, `WriteContext`)?
3. How do we handle context in async callbacks?
4. Should context be immutable or allow mutations?
5. How do we handle context in error handlers?

---

## References

- Current global state usage: 209 references across 9 files
- Function count: 87 exported functions across 22 files
- Test count: 868 tests that must continue passing
- Security triage: `.security/SECURITY_TRIAGE.md`
- Codebase documentation: `llm.md`

---

**Last Updated**: January 2026  
**Status**: Ready for Implementation  
**Estimated Completion**: 1-2 weeks with careful, incremental approach

