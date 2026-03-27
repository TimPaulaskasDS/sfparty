# STRIDE + Lateral Movement Security Analysis for sfparty

## Objective
Perform a comprehensive security analysis of the sfparty codebase using STRIDE threat modeling and lateral movement analysis, prioritized using MoSCoW methodology to focus on critical issues.

## Output Documents
When executed, this prompt will generate the following documents in `.security/` directory:
- **SECURITY_ANALYSIS_REPORT.md**: Detailed security findings, vulnerabilities, and remediation status
- **SECURITY_TRIAGE.md**: Prioritized security issues with effort estimates and timelines

> **Note**: The `.security/` directory is git-ignored and contains sensitive vulnerability information. These documents should NOT be committed to source control.
>
> **This prompt file** (`prompts/SECURITY_ANALYSIS_PROMPT.md`) is safe to commit and can be used with Cursor's `@` feature to regenerate the security analysis documents.

## Workflow
1. **Initial Analysis**: Execute this prompt to perform security analysis
2. **Report Generation**: Analysis results are documented in `.security/SECURITY_ANALYSIS_REPORT.md`
3. **Triage**: Issues are prioritized in `.security/SECURITY_TRIAGE.md`
4. **Remediation**: Fix issues according to triage priorities
5. **Update Report**: Mark resolved issues in `.security/SECURITY_ANALYSIS_REPORT.md` with resolution details
6. **Re-analysis**: Re-run analysis periodically (quarterly recommended) or after major changes

## Analysis Framework

### STRIDE Threat Model
Analyze the codebase for the following threat categories:

#### S - Spoofing Identity
- **MUST**: Verify git command execution cannot be spoofed via environment variable manipulation
- **MUST**: Ensure file path resolution cannot be manipulated to access unintended files
- **SHOULD**: Validate npm registry responses to prevent package confusion attacks
- **COULD**: Implement digital signatures for configuration files

#### T - Tampering with Data
- **MUST**: Verify XML/YAML/JSON parsing cannot inject malicious content into generated files
- **MUST**: Ensure file write operations use atomic writes or proper locking to prevent race conditions
- **SHOULD**: Validate all metadata before writing to ensure schema compliance
- **COULD**: Add checksums or integrity verification for critical files

#### R - Repudiation
- **SHOULD**: Implement audit logging for all file modifications in git mode
- **COULD**: Track which operations modify which files for forensic purposes
- **WON'T**: Full audit trail system (out of scope for CLI tool)

#### I - Information Disclosure
- **MUST**: Ensure error messages don't reveal sensitive file system paths outside workspace
- **MUST**: Verify temporary files are not created with world-readable permissions
- **SHOULD**: Sanitize all error messages to prevent path disclosure
- **COULD**: Add option to redact sensitive metadata from logs

#### D - Denial of Service
- **MUST**: Verify no unbounded memory usage with extremely large XML files
- **MUST**: Ensure no infinite loops or recursive calls without bounds checking
- **SHOULD**: Implement timeout mechanisms for git operations
- **SHOULD**: Add file size limits to prevent memory exhaustion
- **COULD**: Implement rate limiting for concurrent file operations

#### E - Elevation of Privilege
- **MUST**: Verify file permissions are restricted (0o644) and not executable
- **MUST**: Ensure no operations run with elevated privileges unnecessarily
- **MUST**: Validate that git commands cannot execute arbitrary code
- **SHOULD**: Verify npm update command cannot be hijacked
- **COULD**: Add capability to run in restricted/sandboxed mode

---

### Lateral Movement Analysis
Analyze potential attack vectors for moving through the system:

#### File System Traversal
- **MUST**: Verify `validatePath()` prevents all directory traversal attempts
- **MUST**: Test edge cases: symlinks, hard links, `..`, `.`, absolute paths, Windows paths
- **MUST**: Ensure no file operations occur outside workspace root
- **SHOULD**: Test Unicode and special character handling in paths
- **COULD**: Implement chroot-like restrictions

#### Command Injection
- **MUST**: Verify `validateGitRef()` prevents command injection via git references
- **MUST**: Ensure all child process spawning uses array arguments (not string concatenation)
- **MUST**: Test git operations with malicious input: `; rm -rf /`, `$(malicious)`, backticks
- **SHOULD**: Implement allowlist for git commands
- **COULD**: Use git library instead of shell commands

#### Dependency Chain Attacks
- **MUST**: Verify npm registry URL is hardcoded and HTTPS-only
- **SHOULD**: Implement subresource integrity (SRI) or package verification
- **SHOULD**: Review all dependencies for known vulnerabilities (npm audit)
- **COULD**: Implement dependency pinning and lock file verification

#### Environment Variable Poisoning
- **MUST**: Verify INIT_CWD and other environment variables are sanitized
- **MUST**: Test behavior with malicious environment variables
- **SHOULD**: Explicitly validate/sanitize all environment inputs
- **COULD**: Run in isolated environment with minimal env vars

#### Configuration Injection
- **MUST**: Verify `sfdx-project.json` parsing prevents prototype pollution
- **MUST**: Ensure YAML parsing uses safe schema (JSON_SCHEMA)
- **MUST**: Test with malicious JSON/YAML payloads
- **SHOULD**: Implement schema validation for all configuration files
- **COULD**: Add configuration signing/verification

---

## Specific Code Areas to Analyze

### Critical Priority (MUST Address)

#### 1. File System Operations (`src/lib/fileUtils.ts`)
```
Analysis Checklist:
□ validatePath() - Test with: ../, ./, symlinks, absolute paths, Unicode, null bytes
□ readJSON() - Verify JSON.parse cannot cause prototype pollution
□ readYAML() - Confirm yaml.load uses JSON_SCHEMA (not DEFAULT_SCHEMA)
□ writeFile() - Verify atomic writes or proper error handling
□ replaceSpecialChars() - Test with all edge cases and special characters
□ Verify all fs operations check existence before read/write/delete
□ Ensure proper error handling doesn't expose sensitive paths
```

#### 2. Git Operations (`src/lib/gitUtils.ts`)
```
Analysis Checklist:
□ validateGitRef() - Test with: semicolons, backticks, $(), pipes, redirects
□ diff() - Verify execFileSync uses array args, not string concatenation
□ log() - Ensure no command injection via git log arguments
□ isGitRepo() - Verify doesn't follow symlinks outside workspace
□ Test with malicious branch names, commit messages, file paths
□ Verify timeout mechanisms prevent hanging on large repos
```

#### 3. XML/YAML/JSON Parsing (`src/party/split.ts`, `src/party/combine.ts`)
```
Analysis Checklist:
□ XML parsing - Test with XML bombs, XXE, billion laughs attack
□ yaml.load() - Verify uses JSON_SCHEMA, not DEFAULT_FULL_SCHEMA
□ JSON.parse() - Test with prototype pollution payloads (__proto__, constructor)
□ Verify no eval() or Function() constructors used
□ Test with deeply nested structures (stack overflow)
□ Test with extremely large files (memory exhaustion)
□ Verify all transformations sanitize output
```

#### 4. Process Execution (`src/index.ts`, `src/lib/checkVersion.ts`)
```
Analysis Checklist:
□ npm update execution - Verify cannot be hijacked
□ execFileSync/spawn usage - Confirm array arguments, not string
□ Child process timeout mechanisms
□ Verify no shell: true option used
□ Test with malicious npm/git executables in PATH
```

### High Priority (SHOULD Address)

#### 5. Global State Management (`src/index.ts`)
```
Analysis Checklist:
□ Review global object usage for race conditions
□ Verify state isolation between concurrent operations
□ Test concurrent split/combine operations
□ Ensure no shared mutable state between tasks
```

#### 6. Package XML Generation (`src/lib/packageUtil.ts`)
```
Analysis Checklist:
□ Verify XML generation sanitizes member names
□ Test with malicious metadata type names
□ Ensure no XML injection possible
□ Validate against Salesforce package schema
```

#### 7. Error Handling and Logging (`src/lib/fileUtils.ts`, `src/index.ts`)
```
Analysis Checklist:
□ Review all error messages for path disclosure
□ Ensure no sensitive data in logs (API keys, tokens, etc.)
□ Verify error paths don't reveal internal structure
□ Test with various error conditions
```

### Medium Priority (COULD Address)

#### 8. Type Safety (`src/types/metadata.ts`)
```
Analysis Checklist:
□ Review use of 'any' and 'unknown' types
□ Add runtime type validation where appropriate
□ Implement type guards for external data
□ Consider using Zod or similar for runtime validation
```

#### 9. Concurrency and Resource Management
```
Analysis Checklist:
□ Review Listr2 concurrent batch size (hardcoded to 5)
□ Test with very large number of files
□ Verify no file descriptor leaks
□ Test memory usage with large batches
```

---

## Testing Methodology

### Malicious Input Test Cases

#### Path Traversal Test Cases
```bash
# MUST test these:
--source="../../../etc"
--target="/etc/passwd"
--name="../../config"
--source="./valid/../../../etc"
--source="valid/./../../etc"
--source="symlink-to-root"
--source="/absolute/path/outside/workspace"
--source="C:\Windows\System32" (Windows)
--source="%00/etc/passwd" (null byte injection)
```

#### Command Injection Test Cases
```bash
# MUST test these:
--git="HEAD; rm -rf /"
--git="HEAD$(whoami)"
--git="`malicious`"
--git="HEAD|cat /etc/passwd"
--git="HEAD&malicious"
--name="; malicious"
--name="$(command)"
```

#### XML/YAML Injection Test Cases
```yaml
# MUST test these files:
# Billion Laughs Attack
lolz: &lol "lol"
lol2: &lol2 [*lol, *lol, *lol, *lol, *lol, *lol, *lol, *lol, *lol]
lol3: &lol3 [*lol2, *lol2, *lol2, *lol2, *lol2, *lol2, *lol2, *lol2, *lol2]

# Prototype Pollution
__proto__:
  isAdmin: true
constructor:
  prototype:
    isAdmin: true

# XXE (if XML external entities enabled)
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
```

#### Memory Exhaustion Test Cases
```bash
# MUST test these:
# Create 100MB XML file with deeply nested structure
# Create 10,000 individual part files
# Test with circular references in metadata
# Test with extremely long file names (255+ chars)
```

---

## MoSCoW Priority Framework

### MUST Have (Critical - Block Release)
- Path traversal prevention validated comprehensively
- Command injection prevention validated comprehensively  
- Prototype pollution prevention validated
- File permission restrictions validated (0o644)
- Memory exhaustion protection (needs limits)
- XML bomb/XXE protection (needs validation)
- Error message sanitization (needs review)

### SHOULD Have (High Priority - Address Soon)
- Audit logging for file modifications
- Timeout mechanisms for git operations
- File size limits to prevent DoS
- Enhanced error context without path disclosure
- Dependency vulnerability scanning
- Test coverage for CLI entry point

### COULD Have (Medium Priority - Nice to Improve)
- Configuration file signing
- Runtime type validation with Zod
- Sandboxed execution mode
- Rate limiting for concurrent operations
- Checksums for critical files
- Redaction of sensitive metadata in logs

### WON'T Have (Out of Scope)
- Full audit trail system
- Distributed processing support
- Database integration
- Authentication/authorization system (N/A for local tool)
- Network-based deployment

---

## Execution Instructions

### Phase 0: Review Existing Analysis (if available)
```bash
# 1. Check if .security/ directory exists
if [ -d ".security" ]; then
  # Read the current security analysis report
  cat .security/SECURITY_ANALYSIS_REPORT.md
  
  # Review the triage document for priorities
  cat .security/SECURITY_TRIAGE.md
  
  # Check git history for recent security-related changes
  git log --grep="SEC-" --oneline
fi
```

### Phase 1: Automated Scanning (MUST items)
```bash
# 1. Run static analysis
bun audit
bun run lint

# 2. Run test suite
bun test

# 3. Check for vulnerable dependencies
bun audit --production
```

### Phase 2: Manual Code Review (MUST + SHOULD items)
```bash
# Review each critical file:
1. src/lib/fileUtils.ts - validatePath(), all file operations
2. src/lib/gitUtils.ts - validateGitRef(), all git operations
3. src/party/split.ts - XML parsing, transformJSON()
4. src/party/combine.ts - YAML parsing, hydrateObject()
5. src/index.ts - process execution, global state
6. src/lib/packageUtil.ts - XML generation
7. src/lib/checkVersion.ts - npm interaction
```

### Phase 3: Penetration Testing (MUST items)
```bash
# Test with malicious inputs:
1. Create malicious sfdx-project.json files
2. Create malicious XML/YAML metadata files  
3. Test with crafted git references
4. Test with path traversal attempts
5. Test with environment variable poisoning
6. Test with symlink attacks
7. Monitor for memory leaks and DoS conditions
```

### Phase 4: Generate Security Documents
```bash
# Create .security/ directory if it doesn't exist
mkdir -p .security

# Generate SECURITY_ANALYSIS_REPORT.md with findings
# Generate SECURITY_TRIAGE.md with prioritized issues
# Document all findings, status, and remediation steps
```

### Phase 5: Update Security Documents
```bash
# After completing analysis and fixes:
1. Update .security/SECURITY_ANALYSIS_REPORT.md with:
   - Mark resolved issues as "✅ RESOLVED" with resolution details
   - Update status dates
   - Add resolution notes including:
     * Files modified
     * Code changes made
     * Test results
     * Verification steps
2. Update .security/SECURITY_TRIAGE.md with:
   - Mark completed issues
   - Update status (Open → In Progress → Resolved)
   - Add actual effort vs. estimated effort
```

---

## Report Template

### Report Structure (for SECURITY_ANALYSIS_REPORT.md)
```markdown
# Security Analysis Report: sfparty

## Executive Summary
[High-level overview with current status]

## Critical Issues (MUST Fix)
### Issue 1: [Title]
- **STRIDE Category**: [S/T/R/I/D/E]
- **Severity**: Critical
- **Location**: [file:line]
- **Description**: [detailed description]
- **Proof of Concept**: [reproduction steps]
- **Impact**: [security impact]
- **Remediation**: [specific fix]
- **Status**: [Open/✅ RESOLVED]
- **Triage ID**: [SEC-XXX]
- **Resolution Details**: [if resolved]

## High Priority Issues (SHOULD Fix)
[Same format as above]

## Medium Priority Issues (COULD Fix)
[Same format as above]

## Verified Mitigations
[List of security controls that are working correctly]

## Testing Results
[Summary of penetration testing results]

## Recommendations
1. [Prioritized list of recommendations]

## Sign-off
- Analyst: [Name]
- Date: [Date]
- Last Updated: [Date]
- Next Review: [Date]
- **Triage Document**: See `.security/SECURITY_TRIAGE.md`
- **Analysis Prompt**: See `prompts/SECURITY_ANALYSIS_PROMPT.md`
```

### Triage Structure (for SECURITY_TRIAGE.md)
```markdown
# Security Issues Triage: sfparty

## Triage Summary
[Summary table of issues by priority]

## 🔴 Critical Issues (MUST Fix)
### Issue #1: [Title]
- **ID**: SEC-001
- **Effort**: [Small/Medium/Large]
- **Risk**: [Critical/High/Medium/Low]
- **Status**: [Open/In Progress/Resolved]
- **Target Date**: [Date]
- **Action Plan**: [Steps to resolve]

## 🟠 High Priority Issues (SHOULD Fix)
[Same format]

## 🟡 Medium Priority Issues (COULD Fix)
[Same format]
```

---

## Success Criteria

### Definition of Done
- [ ] All MUST issues resolved or documented with compensating controls
- [ ] All SHOULD issues triaged and scheduled
- [ ] Test suite includes security test cases
- [ ] Documentation updated with security considerations
- [ ] CI/CD includes automated security checks
- [ ] Security policy documented in SECURITY.md

### Regression Prevention
- [ ] Add security tests to prevent regression
- [ ] Document secure coding guidelines for contributors
- [ ] Add pre-commit hooks for security checks
- [ ] Schedule quarterly security reviews

---

## Document Maintenance

### When to Update This Prompt
- When analysis methodology changes
- When new threat categories are identified
- When analysis framework is enhanced
- When execution instructions need refinement

### When to Update the Reports
- After completing security fixes (mark as resolved)
- After quarterly security reviews
- After major code changes
- When new vulnerabilities are discovered
- When security controls are added/removed

---

**Document Version**: 2.0  
**Framework**: STRIDE + Lateral Movement + MoSCoW  
**Target**: sfparty codebase  
**Output Location**: `.security/` directory (git-ignored)  
**Usage**: Reference this file in Cursor with `@prompts/SECURITY_ANALYSIS_PROMPT.md` to regenerate security analysis documents

