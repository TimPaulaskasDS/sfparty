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
- **Current Test Count**: 868 tests (must all continue passing)

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
   - Add `ctx: AppContext` to `SplitConfig` interface
   - Store context in class instance
   - Replace global references with `this.ctx`
2. Migrate `src/party/combine.ts` (47 references)
   - Add `ctx: AppContext` to `CombineConfig` interface
   - Store context in class instance
   - Replace global references with `this.ctx`
3. Update `src/index.ts` handlers to create and pass context
   - Update `processSplit()` to accept and pass context
   - Update `processCombine()` to accept and pass context
   - Pass context in `Split` and `Combine` config objects
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
    → new Split({ ctx, metadataDefinition, ... })  // Context in config object
      → split.split()
        → fileUtils.readFile(ctx, filePath)
```

**Important**: `Split` and `Combine` classes use config objects, so context must be added to their config interfaces:
- `SplitConfig` needs `ctx: AppContext`
- `CombineConfig` needs `ctx: AppContext`

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
interface SplitConfig {
  metadataDefinition: MetadataDefinition
  sourceDir: string
  targetDir: string
  metaFilePath: string
  sequence: number
  total: number
  keepFalseValues?: boolean
}

export class Split {
  constructor(config: SplitConfig) {
    // Initialize from config
  }
  
  async split(): Promise<boolean> {
    const basedir = global.__basedir
    global.logger?.error('Error')
    // ...
  }
}
```

**After**:
```typescript
interface SplitConfig {
  ctx: AppContext  // NEW: Add context to config
  metadataDefinition: MetadataDefinition
  sourceDir: string
  targetDir: string
  metaFilePath: string
  sequence: number
  total: number
  keepFalseValues?: boolean
}

export class Split {
  private ctx: AppContext
  
  constructor(config: SplitConfig) {
    this.ctx = config.ctx  // Store context from config
    // ... other initialization
  }
  
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
  
  processSplit(ctx, types[0], argv)
}
```

**Note**: `processSplit` and `processCombine` will need to pass context to the `Split` and `Combine` constructors via their config objects:

```typescript
// In processSplit function
const metadataItem = new Split({
  ctx,  // NEW: Add context to config
  metadataDefinition: typeObj.definition,
  sourceDir: sourceDir,
  targetDir: targetDir,
  metaFilePath: filePath,
  sequence: index + 1,
  total: processed.total,
  keepFalseValues: argv.keepFalseValues || false,
})
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
   - **Recommendation**: Required for functions that use global state, optional for pure utilities
2. Should we have different context types (e.g., `ReadContext`, `WriteContext`)?
   - **Recommendation**: Start with single `AppContext`, split later if needed
3. How do we handle context in async callbacks?
   - **Recommendation**: Pass context explicitly, avoid closures that capture global state
4. Should context be immutable or allow mutations?
   - **Recommendation**: Mostly immutable, but allow mutations for `process` stats (tracked per operation)
5. How do we handle context in error handlers?
   - **Recommendation**: Pass context to error handlers explicitly
6. Should context be in config objects or constructor parameters?
   - **Recommendation**: In config objects (matches current `Split`/`Combine` pattern)

---

## Common Pitfalls and How to Avoid Them

### Pitfall 1: Forgetting to Pass Context Through Call Chains

**Problem**: Function A calls function B, but context isn't passed, causing runtime errors.

**Example**:
```typescript
// ❌ WRONG - Missing context
function processFiles(files: string[]) {
  files.forEach(file => {
    readFile(file)  // Missing ctx parameter!
  })
}

// ✅ CORRECT - Context passed explicitly
function processFiles(ctx: AppContext, files: string[]) {
  files.forEach(file => {
    readFile(ctx, file)  // Context passed
  })
}
```

**Prevention**: 
- TypeScript will catch missing parameters at compile time
- Run `bun run build` after each change to catch errors early
- Use grep to find all call sites: `grep -r "readFile(" src/`

### Pitfall 2: Accessing Global State After Migration

**Problem**: Some code still uses `global.` after migration, causing inconsistent behavior.

**Example**:
```typescript
// ❌ WRONG - Still using global
function helper() {
  global.logger?.error('Error')  // Should use ctx.logger
}

// ✅ CORRECT - Using context
function helper(ctx: AppContext) {
  ctx.logger.error('Error')
}
```

**Prevention**:
- Use grep to find remaining global references: `grep -r "global\." src/`
- Add linting rule to prevent new global usage
- Code review checklist item

### Pitfall 3: Context Not Available in Async Callbacks

**Problem**: Async callbacks lose access to context if not passed explicitly.

**Example**:
```typescript
// ❌ WRONG - Context captured in closure (works but fragile)
function processWithCallback(ctx: AppContext) {
  setTimeout(() => {
    ctx.logger.error('Error')  // Works, but context might be stale
  }, 1000)
}

// ✅ CORRECT - Context passed explicitly to callback
function processWithCallback(ctx: AppContext) {
  setTimeout(() => {
    logError(ctx, 'Error')  // Explicit context passing
  }, 1000)
}
```

**Prevention**:
- Always pass context as explicit parameter to callbacks
- Avoid capturing context in closures unless necessary
- Document when closure capture is intentional

### Pitfall 4: Test Context Not Matching Production Context

**Problem**: Test context missing required properties, causing test failures.

**Example**:
```typescript
// ❌ WRONG - Missing required properties
const ctx = createTestContext({
  logger: mockLogger
  // Missing basedir, format, etc.
})

// ✅ CORRECT - All required properties provided
const ctx = createTestContext({
  logger: mockLogger,
  basedir: '/test',
  format: 'yaml',
  // ... all required properties
})
```

**Prevention**:
- Use `createTestContext()` helper that provides all defaults
- TypeScript will catch missing required properties
- Add runtime validation in development mode

### Pitfall 5: Mutating Context Across Operations

**Problem**: Context mutations from one operation affecting another.

**Example**:
```typescript
// ❌ WRONG - Mutating shared context
function operation1(ctx: AppContext) {
  ctx.process = { total: 100 }  // Mutates shared context
}

function operation2(ctx: AppContext) {
  // ctx.process might have unexpected values from operation1
}

// ✅ CORRECT - Create new context per operation or use local state
function operation1(ctx: AppContext) {
  const localProcess = { total: 100 }  // Local state
  // Use localProcess, not ctx.process
}
```

**Prevention**:
- Document which context properties are mutable
- Create new context instances for parallel operations
- Use local variables for operation-specific state

### Pitfall 6: Circular Dependencies with Context

**Problem**: Module A needs context from module B, but B also needs A.

**Example**:
```typescript
// ❌ WRONG - Circular dependency
// fileUtils.ts
import { createContext } from './context.js'
export function readFile(ctx: AppContext, ...) { }

// context.ts
import { readFile } from './fileUtils.js'  // Circular!
export function createContext() {
  // Uses readFile somehow
}
```

**Prevention**:
- Keep context creation in separate module with no business logic
- Context should only contain data, not call business functions
- Use dependency injection, not imports

---

## Edge Cases and Special Scenarios

### Edge Case 1: Functions That Only Need Logger

**Scenario**: Some utility functions only need `logger`, not full context.

**Solution**: Create minimal context type or make logger optional:

```typescript
// Option 1: Minimal context
interface LogContext {
  logger: Logger
}

function utilityFunction(ctx: LogContext, data: string) {
  ctx.logger.info(data)
}

// Option 2: Optional logger in full context
function utilityFunction(ctx: Partial<AppContext>, data: string) {
  ctx.logger?.info(data)  // Optional chaining
}
```

**Recommendation**: Use Option 1 for functions that only need logger. Keep full `AppContext` for functions that need multiple properties.

### Edge Case 2: Error Handlers That Need Context

**Scenario**: Error handlers need context for logging, but are called from catch blocks.

**Solution**: Pass context to error handlers:

```typescript
// Before
try {
  processFile(file)
} catch (error) {
  handleFileError(error, global.logger)  // Global logger
}

// After
try {
  processFile(ctx, file)
} catch (error) {
  handleFileError(error, ctx.logger)  // Context logger
}
```

**Note**: Update all `handleFileError` call sites to pass context.

### Edge Case 3: Functions Called from Multiple Places

**Scenario**: Function is called from both migrated and non-migrated code.

**Solution**: Create wrapper function during transition:

```typescript
// During migration - support both patterns
export async function readFile(
  ctxOrPath: AppContext | string,
  pathOrConvert?: string | boolean,
  convertOrFs?: boolean | typeof fs,
  fsTmp?: typeof fs,
): Promise<unknown> {
  // Detect if first param is context or path
  if (typeof ctxOrPath === 'string') {
    // Old signature - use global state
    const path = ctxOrPath
    const convert = pathOrConvert as boolean ?? true
    const fs = convertOrFs as typeof fs ?? fsDefault
    // ... old implementation with global
  } else {
    // New signature - use context
    const ctx = ctxOrPath
    const path = pathOrConvert as string
    const convert = convertOrFs as boolean ?? true
    const fs = fsTmp ?? fsDefault
    // ... new implementation with context
  }
}
```

**Recommendation**: Avoid this if possible. Migrate all callers at once. Only use during transition period.

### Edge Case 4: Static/Class Methods That Need Context

**Scenario**: Static methods or class methods that don't have instance context.

**Solution**: Pass context as parameter:

```typescript
// Before
class Utils {
  static process(data: string) {
    global.logger?.info(data)
  }
}

// After
class Utils {
  static process(ctx: AppContext, data: string) {
    ctx.logger.info(data)
  }
}
```

### Edge Case 5: Callbacks in Third-Party Libraries

**Scenario**: Third-party library callbacks that can't be modified to accept context.

**Solution**: Capture context in closure (acceptable for this case):

```typescript
function processWithLibrary(ctx: AppContext, data: string) {
  // Third-party library callback - can't modify signature
  library.process(data, (result) => {
    // Context captured in closure - acceptable for third-party callbacks
    ctx.logger.info(`Result: ${result}`)
  })
}
```

**Note**: Document when closure capture is intentional and why.

### Edge Case 6: Recursive Functions

**Scenario**: Recursive functions need to pass context through all recursive calls.

**Solution**: Always pass context as first parameter:

```typescript
// Before
function processTree(node: Node) {
  if (global.__basedir) {
    // process node
  }
  node.children.forEach(child => {
    processTree(child)  // Recursive call
  })
}

// After
function processTree(ctx: AppContext, node: Node) {
  if (ctx.basedir) {
    // process node
  }
  node.children.forEach(child => {
    processTree(ctx, child)  // Context passed recursively
  })
}
```

---

## Troubleshooting Guide

### Issue: TypeScript Errors After Migration

**Symptoms**: `TS2554: Expected X arguments, but got Y`

**Cause**: Function signature changed but caller not updated

**Solution**:
1. Check function signature in definition
2. Find all call sites: `grep -r "functionName(" src/`
3. Update all call sites to pass context
4. Run `bun run build` to verify

### Issue: Tests Failing After Migration

**Symptoms**: Tests fail with "Cannot read property 'logger' of undefined"

**Cause**: Test not providing context

**Solution**:
1. Check test setup - ensure `createTestContext()` is called
2. Verify all required context properties are provided
3. Check if test helper needs updating
4. Run single test file to isolate: `bun test test/lib/fileUtils.test.ts`

### Issue: Runtime Errors in Production

**Symptoms**: "ctx is undefined" errors at runtime

**Cause**: Context not passed through call chain

**Solution**:
1. Add runtime validation in development mode
2. Check call stack to find where context was lost
3. Verify all functions in call chain accept and pass context
4. Add logging to trace context propagation

### Issue: Performance Degradation

**Symptoms**: Operations slower after migration

**Cause**: Unlikely, but possible if context creation is expensive

**Solution**:
1. Profile before/after with performance logger
2. Ensure context objects are lightweight (just references)
3. Avoid deep cloning context
4. Reuse context instances when safe

### Issue: Global State Still Being Used

**Symptoms**: Some code still uses `global.` after migration

**Cause**: Missed some references during migration

**Solution**:
1. Run: `grep -r "global\." src/` to find all references
2. Check if reference is in context creation (acceptable) or business logic (needs fix)
3. Update remaining references
4. Add linting rule to prevent new global usage

---

## Migration Verification Checklist

After each phase, verify:

### Phase 1 Verification
- [ ] `AppContext` interface defined and exported
- [ ] `createContext()` function works correctly
- [ ] `createTestContext()` helper works in tests
- [ ] Context creation tests pass
- [ ] No TypeScript errors

### Phase 2 Verification
- [ ] All `fileUtils` functions accept context
- [ ] All `fileUtils` callers updated
- [ ] All `fileUtils` tests pass
- [ ] No `global.` references in `fileUtils.ts` (except if needed for bridge)
- [ ] Full test suite passes (868 tests)

### Phase 3 Verification
- [ ] `Split` class uses context from config
- [ ] `Combine` class uses context from config
- [ ] `processSplit` and `processCombine` pass context
- [ ] All split/combine tests pass
- [ ] No `global.` references in `split.ts` or `combine.ts`
- [ ] Full test suite passes (868 tests)

### Phase 4 Verification
- [ ] All remaining modules migrated
- [ ] All tests pass
- [ ] No `global.` references in business logic
- [ ] Full test suite passes (868 tests)

### Phase 5 Verification
- [ ] `GlobalContext` interface removed
- [ ] Global state declarations removed
- [ ] Linting rule added to prevent `global.` usage
- [ ] Documentation updated
- [ ] All 868 tests pass
- [ ] Code review completed
- [ ] `SECURITY_TRIAGE.md` updated

---

## Performance Considerations

### Context Object Size

Context objects are lightweight - they contain references, not data:
- Logger: Reference to winston instance (~few KB)
- Basedir: String (~100 bytes)
- Format: String (~10 bytes)
- MetaTypes: Reference to object (~few KB)
- Total: ~10-20 KB per context instance

**Impact**: Negligible - context passing adds no measurable overhead.

### Context Creation Overhead

Creating context is O(1) operation:
- Object literal creation: ~microseconds
- No deep cloning needed
- No async operations

**Impact**: Negligible - context creation is instant.

### Memory Usage

Context instances are small and short-lived:
- Created per operation
- Garbage collected after operation completes
- No memory leaks expected

**Impact**: Minimal - no memory concerns.

### Benchmarking

If performance is a concern, benchmark before/after:

```typescript
// Before migration
const start = performance.now()
await processSplit(type, argv)
const duration = performance.now() - start

// After migration
const start = performance.now()
const ctx = createContext({...})
await processSplit(ctx, type, argv)
const duration = performance.now() - start
```

**Expected**: No significant difference (< 1ms overhead).

---

## Validation and Testing Strategy

### Pre-Migration Validation

Before starting migration:
1. Run full test suite: `bun run test` (should pass)
2. Run coverage: `bun run test:coverage` (note baseline)
3. Run build: `bun run build` (should succeed)
4. Document current performance (if concerned)

### During Migration Validation

After each module:
1. Run build: `bun run build` (catch TypeScript errors)
2. Run lint: `bun run lint:fix` (catch style issues)
3. Run tests: `bun run test` (catch functional regressions)
4. Run coverage: `bun run test:coverage` (ensure no drop)

### Post-Migration Validation

After all phases:
1. Full test suite: `bun run test` (all 868 tests pass)
2. Coverage check: `bun run test:coverage` (maintain 80%+)
3. Build check: `bun run build` (no errors)
4. Lint check: `bun run lint` (no errors)
5. Global check: `grep -r "global\." src/` (only in context creation)
6. Manual testing: Run actual split/combine operations
7. Performance check: Compare before/after (if concerned)

---

## Rollback Procedures

### Immediate Rollback (Git)

If critical issues arise:
```bash
git log --oneline  # Find last good commit
git revert <commit-hash>  # Or
git reset --hard <commit-hash>  # If not pushed
```

### Partial Rollback

If only one module has issues:
1. Revert that module's changes
2. Keep completed modules migrated
3. Fix issues in reverted module
4. Re-migrate when fixed

### Incremental Fix

If issues are minor:
1. Identify problematic code
2. Fix in small commits
3. Test after each fix
4. Continue migration when stable

---

## Additional Resources

### Code References

- Current global state: `src/index.ts` lines 99-114
- Split class: `src/party/split.ts`
- Combine class: `src/party/combine.ts`
- File utilities: `src/lib/fileUtils.ts`

### Test References

- Test helpers: `test/helpers/` (create if needed)
- File utils tests: `test/lib/file/fileUtils.test.ts`
- Split tests: `test/party/split.test.ts`
- Combine tests: `test/party/combine.test.ts`

### Documentation

- Security triage: `.security/SECURITY_TRIAGE.md`
- Codebase docs: `llm.md`
- This plan: `.security/SEC-013_REFACTOR_PLAN.md`

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

