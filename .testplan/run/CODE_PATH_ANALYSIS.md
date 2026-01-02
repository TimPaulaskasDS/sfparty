# Code Path Analysis

This document provides detailed code path analysis for each uncovered line.
It identifies the exact conditions needed to reach each line.

## src/lib/pathUtils.ts

### Line 13

**Code:**
```typescript
return sanitizedPathCache.get(str)!
```

**Context:**
```typescript
  10 | 
  11 | 	// Check cache first
  12 | 	if (sanitizedPathCache.has(str)) {
  13 | 		return sanitizedPathCache.get(str)!  <-- UNCOVERED
  14 | 	}
  15 | 
  16 | 	const sanitized = str
```

**Conditions to Reach This Line:**

- Line 9: if - Condition: `typeof str !== 'string'`
- Line 12: if - Condition: `sanitizedPathCache.has(str`

**Test Scenario:**

- **Description:** Cover line 13: return sanitizedPathCache.get(str)!
- **Setup:**
  - Set up conditions for this return path
  - Ensure condition is true: typeof str !== 'string'
  - Ensure condition is true: sanitizedPathCache.has(str
- **Action:**
  - Execute function
- **Assertions:**
  - Verify returns: sanitizedPathCache.get(str)!

### Line 28

**Code:**
```typescript
sanitizedPathCache.set(str, sanitized)
```

**Context:**
```typescript
  25 | 
  26 | 	// Only cache if string actually changed (most paths don't need sanitization)
  27 | 	if (sanitized !== str) {
  28 | 		sanitizedPathCache.set(str, sanitized)  <-- UNCOVERED
  29 | 	}
  30 | 
  31 | 	return sanitized
```

**Conditions to Reach This Line:**

- Line 9: if - Condition: `typeof str !== 'string'`
- Line 12: if - Condition: `sanitizedPathCache.has(str`
- Line 27: if - Condition: `sanitized !== str`

**Test Scenario:**

- **Description:** Cover line 28: sanitizedPathCache.set(str, sanitized)
- **Setup:**
  - Ensure condition is true: typeof str !== 'string'
  - Ensure condition is true: sanitizedPathCache.has(str
  - Ensure condition is true: sanitized !== str

## src/lib/packageUtil.ts

### Line 152

**Code:**
```typescript
const typeArray = Object.values(global.metaTypes || {}).map(
```

**Context:**
```typescript
 149 | 			if (that.packageJSON.Package.types === undefined)
 150 | 				return 'No types found'
 151 | 
 152 | 			const typeArray = Object.values(global.metaTypes || {}).map(  <-- UNCOVERED
 153 | 				(metaType) => metaType.definition.root,
 154 | 			)
 155 | 			that.packageJSON.Package.types.forEach((typeItem) => {
```

**Conditions to Reach This Line:**

- Line 142: if - Condition: `that.packageJSON === undefined`
- Line 146: if - Condition: `that.packageJSON.Package === undefined`
- Line 149: if - Condition: `that.packageJSON.Package.types === undefined`

**Test Scenario:**

- **Description:** Cover line 152: const typeArray = Object.values(global.metaTypes |...
- **Setup:**
  - Ensure condition is true: that.packageJSON === undefined
  - Ensure condition is true: that.packageJSON.Package === undefined
  - Ensure condition is true: that.packageJSON.Package.types === undefined

### Line 153

**Code:**
```typescript
(metaType) => metaType.definition.root,
```

**Context:**
```typescript
 150 | 				return 'No types found'
 151 | 
 152 | 			const typeArray = Object.values(global.metaTypes || {}).map(
 153 | 				(metaType) => metaType.definition.root,  <-- UNCOVERED
 154 | 			)
 155 | 			that.packageJSON.Package.types.forEach((typeItem) => {
 156 | 				if (typeArray.includes(typeItem.name || '')) {
```

**Conditions to Reach This Line:**

- Line 142: if - Condition: `that.packageJSON === undefined`
- Line 146: if - Condition: `that.packageJSON.Package === undefined`
- Line 149: if - Condition: `that.packageJSON.Package.types === undefined`

**Test Scenario:**

- **Description:** Cover line 153: (metaType) => metaType.definition.root,
- **Setup:**
  - Ensure condition is true: that.packageJSON === undefined
  - Ensure condition is true: that.packageJSON.Package === undefined
  - Ensure condition is true: that.packageJSON.Package.types === undefined

### Line 154

**Code:**
```typescript
)
```

**Context:**
```typescript
 151 | 
 152 | 			const typeArray = Object.values(global.metaTypes || {}).map(
 153 | 				(metaType) => metaType.definition.root,
 154 | 			)  <-- UNCOVERED
 155 | 			that.packageJSON.Package.types.forEach((typeItem) => {
 156 | 				if (typeArray.includes(typeItem.name || '')) {
 157 | 					typeItem.members = typeItem.members.filter(
```

**Conditions to Reach This Line:**

- Line 142: if - Condition: `that.packageJSON === undefined`
- Line 146: if - Condition: `that.packageJSON.Package === undefined`
- Line 149: if - Condition: `that.packageJSON.Package.types === undefined`

**Test Scenario:**

- **Description:** Cover line 154: )
- **Setup:**
  - Ensure condition is true: that.packageJSON === undefined
  - Ensure condition is true: that.packageJSON.Package === undefined
  - Ensure condition is true: that.packageJSON.Package.types === undefined

### Line 155

**Code:**
```typescript
that.packageJSON.Package.types.forEach((typeItem) => {
```

**Context:**
```typescript
 152 | 			const typeArray = Object.values(global.metaTypes || {}).map(
 153 | 				(metaType) => metaType.definition.root,
 154 | 			)
 155 | 			that.packageJSON.Package.types.forEach((typeItem) => {  <-- UNCOVERED
 156 | 				if (typeArray.includes(typeItem.name || '')) {
 157 | 					typeItem.members = typeItem.members.filter(
 158 | 						(member) => !member.endsWith(`.${global.format}`),
```

**Conditions to Reach This Line:**

- Line 142: if - Condition: `that.packageJSON === undefined`
- Line 146: if - Condition: `that.packageJSON.Package === undefined`
- Line 149: if - Condition: `that.packageJSON.Package.types === undefined`

**Test Scenario:**

- **Description:** Cover line 155: that.packageJSON.Package.types.forEach((typeItem) ...
- **Setup:**
  - Ensure condition is true: that.packageJSON === undefined
  - Ensure condition is true: that.packageJSON.Package === undefined
  - Ensure condition is true: that.packageJSON.Package.types === undefined

### Line 156

**Code:**
```typescript
if (typeArray.includes(typeItem.name || '')) {
```

**Context:**
```typescript
 153 | 				(metaType) => metaType.definition.root,
 154 | 			)
 155 | 			that.packageJSON.Package.types.forEach((typeItem) => {
 156 | 				if (typeArray.includes(typeItem.name || '')) {  <-- UNCOVERED
 157 | 					typeItem.members = typeItem.members.filter(
 158 | 						(member) => !member.endsWith(`.${global.format}`),
 159 | 					)
```

**Conditions to Reach This Line:**

- Line 142: if - Condition: `that.packageJSON === undefined`
- Line 146: if - Condition: `that.packageJSON.Package === undefined`
- Line 149: if - Condition: `that.packageJSON.Package.types === undefined`
- Line 156: if - Condition: `typeArray.includes(typeItem.name || ''`

**Test Scenario:**

- **Description:** Cover line 156: if (typeArray.includes(typeItem.name || '')) {
- **Setup:**
  - Ensure condition is true: that.packageJSON === undefined
  - Ensure condition is true: that.packageJSON.Package === undefined
  - Ensure condition is true: that.packageJSON.Package.types === undefined
  - Ensure condition is true: typeArray.includes(typeItem.name || ''

### Line 247

**Code:**
```typescript
if ((a.name || '') < (b.name || '')) return -1
```

**Context:**
```typescript
 244 | 			}
 245 | 
 246 | 			packageJSON.Package.types.sort((a, b) => {
 247 | 				if ((a.name || '') < (b.name || '')) return -1  <-- UNCOVERED
 248 | 				if ((a.name || '') > (b.name || '')) return 1
 249 | 				return 0
 250 | 			})
```

**Conditions to Reach This Line:**

- Line 142: if - Condition: `that.packageJSON === undefined`
- Line 146: if - Condition: `that.packageJSON.Package === undefined`
- Line 149: if - Condition: `that.packageJSON.Package.types === undefined`
- Line 156: if - Condition: `typeArray.includes(typeItem.name || ''`
- Line 173: if - Condition: `that.packageJSON === undefined`
- Line 177: if - Condition: `type === undefined || type.replaceAll('\t', ''`
- Line 181: if - Condition: `member === undefined || member.replaceAll('\t', ''`
- Line 185: if - Condition: `member.indexOf(`.${global.format}``
- Line 196: if - Condition: `packageJSON.Package.types === undefined`
- Line 200: try
- Line 201: if - Condition: `typeItem.name?.toLowerCase(`
- Line 203: if - Condition: `typeItem.members === undefined`
- Line 209: if
- Line 219: catch
- Line 225: if - Condition: `foundMember`
- Line 226: if - Condition: `foundAsterisk`
- Line 230: try
- Line 231: if - Condition: `typeJSON !== undefined && typeJSON.members`
- Line 234: else
- Line 247: if - Condition: `(a.name || ''`

**Test Scenario:**

- **Description:** Cover line 247: if ((a.name || '') < (b.name || '')) return -1
- **Setup:**
  - Set up conditions for this return path
  - Ensure condition is true: that.packageJSON === undefined
  - Ensure condition is true: that.packageJSON.Package === undefined
  - Ensure condition is true: that.packageJSON.Package.types === undefined
  - Ensure condition is true: typeArray.includes(typeItem.name || ''
  - Ensure condition is true: that.packageJSON === undefined
  - Ensure condition is true: type === undefined || type.replaceAll('\t', ''
  - Ensure condition is true: member === undefined || member.replaceAll('\t', ''
  - Ensure condition is true: member.indexOf(`.${global.format}`
  - Ensure condition is true: packageJSON.Package.types === undefined
  - Ensure condition is true: typeItem.name?.toLowerCase(
  - Ensure condition is true: typeItem.members === undefined
  - Ensure condition is true: foundMember
  - Ensure condition is true: foundAsterisk
  - Ensure condition is true: typeJSON !== undefined && typeJSON.members
  - Ensure condition is true: (a.name || ''
- **Action:**
  - Execute function
- **Assertions:**
  - Verify returns: -1

### Line 248

**Code:**
```typescript
if ((a.name || '') > (b.name || '')) return 1
```

**Context:**
```typescript
 245 | 
 246 | 			packageJSON.Package.types.sort((a, b) => {
 247 | 				if ((a.name || '') < (b.name || '')) return -1
 248 | 				if ((a.name || '') > (b.name || '')) return 1  <-- UNCOVERED
 249 | 				return 0
 250 | 			})
 251 | 		} catch (error) {
```

**Conditions to Reach This Line:**

- Line 142: if - Condition: `that.packageJSON === undefined`
- Line 146: if - Condition: `that.packageJSON.Package === undefined`
- Line 149: if - Condition: `that.packageJSON.Package.types === undefined`
- Line 156: if - Condition: `typeArray.includes(typeItem.name || ''`
- Line 173: if - Condition: `that.packageJSON === undefined`
- Line 177: if - Condition: `type === undefined || type.replaceAll('\t', ''`
- Line 181: if - Condition: `member === undefined || member.replaceAll('\t', ''`
- Line 185: if - Condition: `member.indexOf(`.${global.format}``
- Line 196: if - Condition: `packageJSON.Package.types === undefined`
- Line 200: try
- Line 201: if - Condition: `typeItem.name?.toLowerCase(`
- Line 203: if - Condition: `typeItem.members === undefined`
- Line 209: if
- Line 219: catch
- Line 225: if - Condition: `foundMember`
- Line 226: if - Condition: `foundAsterisk`
- Line 230: try
- Line 231: if - Condition: `typeJSON !== undefined && typeJSON.members`
- Line 234: else
- Line 247: if - Condition: `(a.name || ''`
- Line 248: if - Condition: `(a.name || ''`

**Test Scenario:**

- **Description:** Cover line 248: if ((a.name || '') > (b.name || '')) return 1
- **Setup:**
  - Set up conditions for this return path
  - Ensure condition is true: that.packageJSON === undefined
  - Ensure condition is true: that.packageJSON.Package === undefined
  - Ensure condition is true: that.packageJSON.Package.types === undefined
  - Ensure condition is true: typeArray.includes(typeItem.name || ''
  - Ensure condition is true: that.packageJSON === undefined
  - Ensure condition is true: type === undefined || type.replaceAll('\t', ''
  - Ensure condition is true: member === undefined || member.replaceAll('\t', ''
  - Ensure condition is true: member.indexOf(`.${global.format}`
  - Ensure condition is true: packageJSON.Package.types === undefined
  - Ensure condition is true: typeItem.name?.toLowerCase(
  - Ensure condition is true: typeItem.members === undefined
  - Ensure condition is true: foundMember
  - Ensure condition is true: foundAsterisk
  - Ensure condition is true: typeJSON !== undefined && typeJSON.members
  - Ensure condition is true: (a.name || ''
  - Ensure condition is true: (a.name || ''
- **Action:**
  - Execute function
- **Assertions:**
  - Verify returns: 1

### Line 322

**Code:**
```typescript
if (value.length === 1) {
```

**Context:**
```typescript
 319 | 		try {
 320 | 			let value = currentValue
 321 | 			if (Array.isArray(value)) {
 322 | 				if (value.length === 1) {  <-- UNCOVERED
 323 | 					value = value[0].toString().trim()
 324 | 				}
 325 | 			}
```

**Conditions to Reach This Line:**

- Line 319: try
- Line 321: if - Condition: `Array.isArray(value`
- Line 322: if - Condition: `value.length === 1`

**Test Scenario:**

- **Description:** Cover line 322: if (value.length === 1) {
- **Setup:**
  - Ensure condition is true: Array.isArray(value
  - Ensure condition is true: value.length === 1

## src/lib/performanceLogger.ts

### Line 71

**Code:**
```typescript
if (timing.file) {
```

**Context:**
```typescript
  68 | 		this.activeOperations.delete(operationId)
  69 | 
  70 | 		// Add to file timing if file is specified
  71 | 		if (timing.file) {  <-- UNCOVERED
  72 | 			this.addOperationToFile(timing.file, timing)
  73 | 		}
  74 | 	}
```

**Conditions to Reach This Line:**

- Line 60: if - Condition: `!timing`
- Line 64: if - Condition: `fileSize !== undefined`
- Line 71: if - Condition: `timing.file`

**Test Scenario:**

- **Description:** Cover line 71: if (timing.file) {
- **Setup:**
  - Ensure condition is true: !timing
  - Ensure condition is true: fileSize !== undefined
  - Ensure condition is true: timing.file

### Line 123

**Code:**
```typescript
timing.error = error || 'Operation failed'
```

**Context:**
```typescript
 120 | 		const timing = this.getOrCreateFileTiming(file)
 121 | 		if (!success) {
 122 | 			// Mark as failed - use provided error message or default
 123 | 			timing.error = error || 'Operation failed'  <-- UNCOVERED
 124 | 		}
 125 | 		// Calculate total duration from read, parse, and write times
 126 | 		const readTime = timing.readTime || 0
```

**Conditions to Reach This Line:**

- Line 60: if - Condition: `!timing`
- Line 64: if - Condition: `fileSize !== undefined`
- Line 71: if - Condition: `timing.file`
- Line 121: if - Condition: `!success`

**Test Scenario:**

- **Description:** Cover line 123: timing.error = error || 'Operation failed'
- **Setup:**
  - Ensure condition is true: !timing
  - Ensure condition is true: fileSize !== undefined
  - Ensure condition is true: timing.file
  - Ensure condition is true: !success

### Line 309

**Code:**
```typescript
if (summary.slowestFiles.length > 0) {
```

**Context:**
```typescript
 306 | 			`Average write time: ${this.formatMilliseconds(summary.bottlenecks.avgWriteTime)}`,
 307 | 		)
 308 | 
 309 | 		if (summary.slowestFiles.length > 0) {  <-- UNCOVERED
 310 | 			console.log('\n=== Slowest Files (top 10) ===')
 311 | 			summary.slowestFiles.forEach((item, index) => {
 312 | 				console.log(
```

**Conditions to Reach This Line:**

- Line 60: if - Condition: `!timing`
- Line 64: if - Condition: `fileSize !== undefined`
- Line 71: if - Condition: `timing.file`
- Line 121: if - Condition: `!success`
- Line 247: if - Condition: `ms < 1000`
- Line 251: if - Condition: `seconds < 60`
- Line 266: if - Condition: `minutes > 0`
- Line 279: if - Condition: `startTime`
- Line 283: else
- Line 309: if - Condition: `summary.slowestFiles.length > 0`

**Test Scenario:**

- **Description:** Cover line 309: if (summary.slowestFiles.length > 0) {
- **Setup:**
  - Ensure condition is true: !timing
  - Ensure condition is true: fileSize !== undefined
  - Ensure condition is true: timing.file
  - Ensure condition is true: !success
  - Ensure condition is true: ms < 1000
  - Ensure condition is true: seconds < 60
  - Ensure condition is true: minutes > 0
  - Ensure condition is true: startTime
  - Ensure condition is true: summary.slowestFiles.length > 0

### Line 328

**Code:**
```typescript
if (!this.logFile) return
```

**Context:**
```typescript
 325 | 	 * Write performance summary to file
 326 | 	 */
 327 | 	private writeSummaryToFile(): void {
 328 | 		if (!this.logFile) return  <-- UNCOVERED
 329 | 
 330 | 		try {
 331 | 			// Ensure directory exists
```

**Conditions to Reach This Line:**

- Line 60: if - Condition: `!timing`
- Line 64: if - Condition: `fileSize !== undefined`
- Line 71: if - Condition: `timing.file`
- Line 121: if - Condition: `!success`
- Line 247: if - Condition: `ms < 1000`
- Line 251: if - Condition: `seconds < 60`
- Line 266: if - Condition: `minutes > 0`
- Line 279: if - Condition: `startTime`
- Line 283: else
- Line 309: if - Condition: `summary.slowestFiles.length > 0`
- Line 319: if - Condition: `this.logFile`
- Line 328: if - Condition: `!this.logFile`

**Test Scenario:**

- **Description:** Cover line 328: if (!this.logFile) return
- **Setup:**
  - Set up conditions for this return path
  - Ensure condition is true: !timing
  - Ensure condition is true: fileSize !== undefined
  - Ensure condition is true: timing.file
  - Ensure condition is true: !success
  - Ensure condition is true: ms < 1000
  - Ensure condition is true: seconds < 60
  - Ensure condition is true: minutes > 0
  - Ensure condition is true: startTime
  - Ensure condition is true: summary.slowestFiles.length > 0
  - Ensure condition is true: this.logFile
  - Ensure condition is true: !this.logFile
- **Action:**
  - Execute function
- **Assertions:**
  - Verify returns: value

### Line 375

**Code:**
```typescript
if (operation.duration !== undefined) {
```

**Context:**
```typescript
 372 | 		timing.operations.push(operation)
 373 | 
 374 | 		// Update specific timing fields based on operation type
 375 | 		if (operation.duration !== undefined) {  <-- UNCOVERED
 376 | 			const opType = operation.operation.toLowerCase()
 377 | 			if (opType.includes('read')) {
 378 | 				timing.readTime = operation.duration
```

**Conditions to Reach This Line:**

- Line 60: if - Condition: `!timing`
- Line 64: if - Condition: `fileSize !== undefined`
- Line 71: if - Condition: `timing.file`
- Line 121: if - Condition: `!success`
- Line 247: if - Condition: `ms < 1000`
- Line 251: if - Condition: `seconds < 60`
- Line 266: if - Condition: `minutes > 0`
- Line 279: if - Condition: `startTime`
- Line 283: else
- Line 309: if - Condition: `summary.slowestFiles.length > 0`
- Line 319: if - Condition: `this.logFile`
- Line 328: if - Condition: `!this.logFile`
- Line 330: try
- Line 333: if - Condition: `!fs.existsSync(logDir`
- Line 350: catch
- Line 358: if - Condition: `!timing`
- Line 375: if - Condition: `operation.duration !== undefined`

**Test Scenario:**

- **Description:** Cover line 375: if (operation.duration !== undefined) {
- **Setup:**
  - Set variable to undefined
  - Ensure condition is true: !timing
  - Ensure condition is true: fileSize !== undefined
  - Ensure condition is true: timing.file
  - Ensure condition is true: !success
  - Ensure condition is true: ms < 1000
  - Ensure condition is true: seconds < 60
  - Ensure condition is true: minutes > 0
  - Ensure condition is true: startTime
  - Ensure condition is true: summary.slowestFiles.length > 0
  - Ensure condition is true: this.logFile
  - Ensure condition is true: !this.logFile
  - Ensure condition is true: !fs.existsSync(logDir
  - Ensure condition is true: !timing
  - Ensure condition is true: operation.duration !== undefined
- **Action:**
  - Execute code path that checks for undefined
- **Assertions:**
  - Verify undefined case is handled

### Line 381

**Code:**
```typescript
} else if (opType.includes('write') || opType.includes('save')) {
```

**Context:**
```typescript
 378 | 				timing.readTime = operation.duration
 379 | 			} else if (opType.includes('parse') || opType.includes('xml')) {
 380 | 				timing.parseTime = operation.duration
 381 | 			} else if (opType.includes('write') || opType.includes('save')) {  <-- UNCOVERED
 382 | 				timing.writeTime = operation.duration
 383 | 			}
 384 | 		}
```

**Conditions to Reach This Line:**

- Line 60: if - Condition: `!timing`
- Line 64: if - Condition: `fileSize !== undefined`
- Line 71: if - Condition: `timing.file`
- Line 121: if - Condition: `!success`
- Line 247: if - Condition: `ms < 1000`
- Line 251: if - Condition: `seconds < 60`
- Line 266: if - Condition: `minutes > 0`
- Line 279: if - Condition: `startTime`
- Line 283: else
- Line 309: if - Condition: `summary.slowestFiles.length > 0`
- Line 319: if - Condition: `this.logFile`
- Line 328: if - Condition: `!this.logFile`
- Line 330: try
- Line 333: if - Condition: `!fs.existsSync(logDir`
- Line 350: catch
- Line 358: if - Condition: `!timing`
- Line 375: if - Condition: `operation.duration !== undefined`
- Line 377: if - Condition: `opType.includes('read'`

**Test Scenario:**

- **Description:** Cover line 381: } else if (opType.includes('write') || opType.incl...
- **Setup:**
  - Ensure condition is true: !timing
  - Ensure condition is true: fileSize !== undefined
  - Ensure condition is true: timing.file
  - Ensure condition is true: !success
  - Ensure condition is true: ms < 1000
  - Ensure condition is true: seconds < 60
  - Ensure condition is true: minutes > 0
  - Ensure condition is true: startTime
  - Ensure condition is true: summary.slowestFiles.length > 0
  - Ensure condition is true: this.logFile
  - Ensure condition is true: !this.logFile
  - Ensure condition is true: !fs.existsSync(logDir
  - Ensure condition is true: !timing
  - Ensure condition is true: operation.duration !== undefined
  - Ensure condition is true: opType.includes('read'

## src/lib/writeBatcher.ts

### Line 107

**Code:**
```typescript
this.flushTimer = setTimeout(() => {
```

**Context:**
```typescript
 104 | 			this.flushing = false
 105 | 			// If there are more writes, schedule another flush
 106 | 			if (this.writeQueue.length > 0) {
 107 | 				this.flushTimer = setTimeout(() => {  <-- UNCOVERED
 108 | 					this.flush().catch((err) => {
 109 | 						console.error('WriteBatcher flush error:', err)
 110 | 					})
```

**Conditions to Reach This Line:**

- Line 35: if - Condition: `this.writeQueue.length >= maxQueueSize`
- Line 41: else
- Line 44: if - Condition: `!this.flushTimer && !this.flushing`
- Line 62: if - Condition: `this.flushing || this.writeQueue.length === 0`
- Line 66: if - Condition: `this.flushTimer`
- Line 74: try
- Line 80: loop - Condition: `const write of writes`
- Line 82: if - Condition: `!writesByDir.has(dir`
- Line 106: if - Condition: `this.writeQueue.length > 0`

**Test Scenario:**

- **Description:** Cover line 107: this.flushTimer = setTimeout(() => {
- **Setup:**
  - Ensure condition is true: this.writeQueue.length >= maxQueueSize
  - Ensure condition is true: !this.flushTimer && !this.flushing
  - Ensure condition is true: this.flushing || this.writeQueue.length === 0
  - Ensure condition is true: this.flushTimer
  - Ensure condition is true: const write of writes
  - Ensure condition is true: !writesByDir.has(dir
  - Ensure condition is true: this.writeQueue.length > 0

### Line 108

**Code:**
```typescript
this.flush().catch((err) => {
```

**Context:**
```typescript
 105 | 			// If there are more writes, schedule another flush
 106 | 			if (this.writeQueue.length > 0) {
 107 | 				this.flushTimer = setTimeout(() => {
 108 | 					this.flush().catch((err) => {  <-- UNCOVERED
 109 | 						console.error('WriteBatcher flush error:', err)
 110 | 					})
 111 | 				}, this.batchDelay)
```

**Conditions to Reach This Line:**

- Line 35: if - Condition: `this.writeQueue.length >= maxQueueSize`
- Line 41: else
- Line 44: if - Condition: `!this.flushTimer && !this.flushing`
- Line 62: if - Condition: `this.flushing || this.writeQueue.length === 0`
- Line 66: if - Condition: `this.flushTimer`
- Line 74: try
- Line 80: loop - Condition: `const write of writes`
- Line 82: if - Condition: `!writesByDir.has(dir`
- Line 106: if - Condition: `this.writeQueue.length > 0`

**Test Scenario:**

- **Description:** Cover line 108: this.flush().catch((err) => {
- **Setup:**
  - Ensure condition is true: this.writeQueue.length >= maxQueueSize
  - Ensure condition is true: !this.flushTimer && !this.flushing
  - Ensure condition is true: this.flushing || this.writeQueue.length === 0
  - Ensure condition is true: this.flushTimer
  - Ensure condition is true: const write of writes
  - Ensure condition is true: !writesByDir.has(dir
  - Ensure condition is true: this.writeQueue.length > 0

### Line 109

**Code:**
```typescript
console.error('WriteBatcher flush error:', err)
```

**Context:**
```typescript
 106 | 			if (this.writeQueue.length > 0) {
 107 | 				this.flushTimer = setTimeout(() => {
 108 | 					this.flush().catch((err) => {
 109 | 						console.error('WriteBatcher flush error:', err)  <-- UNCOVERED
 110 | 					})
 111 | 				}, this.batchDelay)
 112 | 			}
```

**Conditions to Reach This Line:**

- Line 35: if - Condition: `this.writeQueue.length >= maxQueueSize`
- Line 41: else
- Line 44: if - Condition: `!this.flushTimer && !this.flushing`
- Line 62: if - Condition: `this.flushing || this.writeQueue.length === 0`
- Line 66: if - Condition: `this.flushTimer`
- Line 74: try
- Line 80: loop - Condition: `const write of writes`
- Line 82: if - Condition: `!writesByDir.has(dir`
- Line 106: if - Condition: `this.writeQueue.length > 0`

**Test Scenario:**

- **Description:** Cover line 109: console.error('WriteBatcher flush error:', err)
- **Setup:**
  - Ensure condition is true: this.writeQueue.length >= maxQueueSize
  - Ensure condition is true: !this.flushTimer && !this.flushing
  - Ensure condition is true: this.flushing || this.writeQueue.length === 0
  - Ensure condition is true: this.flushTimer
  - Ensure condition is true: const write of writes
  - Ensure condition is true: !writesByDir.has(dir
  - Ensure condition is true: this.writeQueue.length > 0

### Line 154

**Code:**
```typescript
await new Promise((resolve) => setTimeout(resolve, 1))
```

**Context:**
```typescript
 151 | 
 152 | 		// Wait for any in-progress flush to complete
 153 | 		while (this.flushing) {
 154 | 			await new Promise((resolve) => setTimeout(resolve, 1))  <-- UNCOVERED
 155 | 		}
 156 | 
 157 | 		// Process all remaining writes in batches to avoid EMFILE errors
```

**Conditions to Reach This Line:**

- Line 35: if - Condition: `this.writeQueue.length >= maxQueueSize`
- Line 41: else
- Line 44: if - Condition: `!this.flushTimer && !this.flushing`
- Line 62: if - Condition: `this.flushing || this.writeQueue.length === 0`
- Line 66: if - Condition: `this.flushTimer`
- Line 74: try
- Line 80: loop - Condition: `const write of writes`
- Line 82: if - Condition: `!writesByDir.has(dir`
- Line 106: if - Condition: `this.writeQueue.length > 0`
- Line 143: if - Condition: `this.flushTimer`
- Line 148: if - Condition: `this.writeQueue.length === 0`
- Line 153: loop - Condition: `this.flushing`

**Test Scenario:**

- **Description:** Cover line 154: await new Promise((resolve) => setTimeout(resolve,...
- **Setup:**
  - Ensure condition is true: this.writeQueue.length >= maxQueueSize
  - Ensure condition is true: !this.flushTimer && !this.flushing
  - Ensure condition is true: this.flushing || this.writeQueue.length === 0
  - Ensure condition is true: this.flushTimer
  - Ensure condition is true: const write of writes
  - Ensure condition is true: !writesByDir.has(dir
  - Ensure condition is true: this.writeQueue.length > 0
  - Ensure condition is true: this.flushTimer
  - Ensure condition is true: this.writeQueue.length === 0
  - Ensure condition is true: this.flushing

## src/lib/fileUtils.ts

### Line 16

**Code:**
```typescript
globalWriteBatcher = new WriteBatcher(batchSize, batchDelay)
```

**Context:**
```typescript
  13 |  * Initialize the global write batcher
  14 |  */
  15 | export function initWriteBatcher(batchSize = 10, batchDelay = 10): void {
  16 | 	globalWriteBatcher = new WriteBatcher(batchSize, batchDelay)  <-- UNCOVERED
  17 | }
  18 | 
  19 | /**
```

**Test Scenario:**

- **Description:** Cover line 16: globalWriteBatcher = new WriteBatcher(batchSize, b...

### Line 23

**Code:**
```typescript
return globalWriteBatcher
```

**Context:**
```typescript
  20 |  * Get the global write batcher
  21 |  */
  22 | export function getWriteBatcher(): WriteBatcher | null {
  23 | 	return globalWriteBatcher  <-- UNCOVERED
  24 | }
  25 | 
  26 | /**
```

**Test Scenario:**

- **Description:** Cover line 23: return globalWriteBatcher
- **Setup:**
  - Set up conditions for this return path
- **Action:**
  - Execute function
- **Assertions:**
  - Verify returns: globalWriteBatcher

### Line 30

**Code:**
```typescript
return globalWriteBatcher?.getQueueLength() ?? 0
```

**Context:**
```typescript
  27 |  * Get the number of pending writes in the batcher
  28 |  */
  29 | export function getWriteBatcherQueueLength(): number {
  30 | 	return globalWriteBatcher?.getQueueLength() ?? 0  <-- UNCOVERED
  31 | }
  32 | 
  33 | /**
```

**Test Scenario:**

- **Description:** Cover line 30: return globalWriteBatcher?.getQueueLength() ?? 0
- **Setup:**
  - Set up conditions for this return path
- **Action:**
  - Execute function
- **Assertions:**
  - Verify returns: globalWriteBatcher?.getQueueLength() ?? 0

### Line 41

**Code:**
```typescript
return globalWriteBatcher?.getQueueStats() ?? null
```

**Context:**
```typescript
  38 | 	batchSize: number
  39 | 	isFlushing: boolean
  40 | } | null {
  41 | 	return globalWriteBatcher?.getQueueStats() ?? null  <-- UNCOVERED
  42 | }
  43 | 
  44 | /**
```

**Test Scenario:**

- **Description:** Cover line 41: return globalWriteBatcher?.getQueueStats() ?? null
- **Setup:**
  - Set up conditions for this return path
- **Action:**
  - Execute function
- **Assertions:**
  - Verify returns: globalWriteBatcher?.getQueueStats() ?? null

### Line 48

**Code:**
```typescript
if (globalWriteBatcher) {
```

**Context:**
```typescript
  45 |  * Wait for all batched writes to complete
  46 |  */
  47 | export async function flushWriteBatcher(): Promise<void> {
  48 | 	if (globalWriteBatcher) {  <-- UNCOVERED
  49 | 		await globalWriteBatcher.waitForCompletion()
  50 | 	}
  51 | }
```

**Conditions to Reach This Line:**

- Line 48: if - Condition: `globalWriteBatcher`

**Test Scenario:**

- **Description:** Cover line 48: if (globalWriteBatcher) {
- **Setup:**
  - Ensure condition is true: globalWriteBatcher

### Line 49

**Code:**
```typescript
await globalWriteBatcher.waitForCompletion()
```

**Context:**
```typescript
  46 |  */
  47 | export async function flushWriteBatcher(): Promise<void> {
  48 | 	if (globalWriteBatcher) {
  49 | 		await globalWriteBatcher.waitForCompletion()  <-- UNCOVERED
  50 | 	}
  51 | }
  52 | 
```

**Conditions to Reach This Line:**

- Line 48: if - Condition: `globalWriteBatcher`

**Test Scenario:**

- **Description:** Cover line 49: await globalWriteBatcher.waitForCompletion()
- **Setup:**
  - Ensure condition is true: globalWriteBatcher

### Line 92

**Code:**
```typescript
return obj.map(sanitizeObject)
```

**Context:**
```typescript
  89 | 		}
  90 | 
  91 | 		if (Array.isArray(obj)) {
  92 | 			return obj.map(sanitizeObject)  <-- UNCOVERED
  93 | 		}
  94 | 
  95 | 		const sanitized: Record<string, unknown> = {}
```

**Conditions to Reach This Line:**

- Line 87: if - Condition: `obj === null || typeof obj !== 'object'`
- Line 91: if - Condition: `Array.isArray(obj`

**Test Scenario:**

- **Description:** Cover line 92: return obj.map(sanitizeObject)
- **Setup:**
  - Set up conditions for this return path
  - Ensure condition is true: obj === null || typeof obj !== 'object'
  - Ensure condition is true: Array.isArray(obj
- **Action:**
  - Execute function
- **Assertions:**
  - Verify returns: obj.map(sanitizeObject)

### Line 99

**Code:**
```typescript
throw new Error(
```

**Context:**
```typescript
  96 | 		for (const key in obj) {
  97 | 			// Reject __proto__ and constructor.prototype keys
  98 | 			if (key === '__proto__' || key === 'constructor') {
  99 | 				throw new Error(  <-- UNCOVERED
 100 | 					'Prototype pollution detected: dangerous key "' +
 101 | 						key +
 102 | 						'" is not allowed',
```

**Conditions to Reach This Line:**

- Line 87: if - Condition: `obj === null || typeof obj !== 'object'`
- Line 91: if - Condition: `Array.isArray(obj`
- Line 96: loop - Condition: `const key in obj`
- Line 98: if - Condition: `key === '__proto__' || key === 'constructor'`

**Test Scenario:**

- **Description:** Cover line 99: throw new Error(
- **Setup:**
  - Create conditions that trigger error
  - Ensure condition is true: obj === null || typeof obj !== 'object'
  - Ensure condition is true: Array.isArray(obj
  - Ensure condition is true: const key in obj
  - Ensure condition is true: key === '__proto__' || key === 'constructor'
- **Action:**
  - Execute code that throws
- **Assertions:**
  - Verify error is thrown/caught correctly

### Line 199

**Code:**
```typescript
return
```

**Context:**
```typescript
 196 | 
 197 | 	// Check cache first - if we've verified it exists, skip entirely
 198 | 	if (verifiedDirectories.has(sanitizedPath)) {
 199 | 		return  <-- UNCOVERED
 200 | 	}
 201 | 
 202 | 	try {
```

**Conditions to Reach This Line:**

- Line 198: if - Condition: `verifiedDirectories.has(sanitizedPath`

**Test Scenario:**

- **Description:** Cover line 199: return
- **Setup:**
  - Set up conditions for this return path
  - Ensure condition is true: verifiedDirectories.has(sanitizedPath
- **Action:**
  - Execute function
- **Assertions:**
  - Verify returns: value

### Line 284

**Code:**
```typescript
return []
```

**Context:**
```typescript
 281 | 		filesList.sort()
 282 | 		return filesList
 283 | 	} catch {
 284 | 		return []  <-- UNCOVERED
 285 | 	}
 286 | }
 287 | 
```

**Conditions to Reach This Line:**

- Line 259: if - Condition: `!exists`
- Line 263: try
- Line 267: loop - Condition: `const file of files`
- Line 268: if - Condition: `!filter`
- Line 270: else
- Line 271: if

**Test Scenario:**

- **Description:** Cover line 284: return []
- **Setup:**
  - Set up conditions for this return path
  - Ensure condition is true: !exists
  - Ensure condition is true: const file of files
  - Ensure condition is true: !filter
- **Action:**
  - Execute function
- **Assertions:**
  - Verify returns: []

### Line 306

**Code:**
```typescript
return []
```

**Context:**
```typescript
 303 | 			.filter((dirent) => dirent.isDirectory())
 304 | 			.map((dirent) => dirent.name)
 305 | 	} catch {
 306 | 		return []  <-- UNCOVERED
 307 | 	}
 308 | }
 309 | 
```

**Conditions to Reach This Line:**

- Line 294: if - Condition: `!exists`
- Line 298: try

**Test Scenario:**

- **Description:** Cover line 306: return []
- **Setup:**
  - Set up conditions for this return path
  - Ensure condition is true: !exists
- **Action:**
  - Execute function
- **Assertions:**
  - Verify returns: []

### Line 327

**Code:**
```typescript
throw error
```

**Context:**
```typescript
 324 | 		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
 325 | 			return false
 326 | 		}
 327 | 		throw error  <-- UNCOVERED
 328 | 	}
 329 | }
 330 | 
```

**Conditions to Reach This Line:**

- Line 316: if - Condition: `!exists`
- Line 320: try
- Line 323: catch
- Line 324: if - Condition: `(error as NodeJS.ErrnoException`

**Test Scenario:**

- **Description:** Cover line 327: throw error
- **Setup:**
  - Create conditions that trigger error
  - Ensure condition is true: !exists
  - Ensure condition is true: (error as NodeJS.ErrnoException
- **Action:**
  - Execute code that throws
- **Assertions:**
  - Verify error is thrown/caught correctly

### Line 372

**Code:**
```typescript
await globalWriteBatcher.addWrite(sanitizedFileName, data)
```

**Context:**
```typescript
 369 | 		// Use write batcher if available and enabled, otherwise write directly
 370 | 		// When memory is critical, direct writes are faster than batching
 371 | 		if (useBatching && globalWriteBatcher) {
 372 | 			await globalWriteBatcher.addWrite(sanitizedFileName, data)  <-- UNCOVERED
 373 | 		} else {
 374 | 			// Direct write (fallback or when batching disabled)
 375 | 			await fsTmp.promises.writeFile(sanitizedFileName, data, 'utf8')
```

**Conditions to Reach This Line:**

- Line 363: try
- Line 371: if - Condition: `useBatching && globalWriteBatcher`

**Test Scenario:**

- **Description:** Cover line 372: await globalWriteBatcher.addWrite(sanitizedFileNam...
- **Setup:**
  - Ensure condition is true: useBatching && globalWriteBatcher

### Line 422

**Code:**
```typescript
throw new Error(
```

**Context:**
```typescript
 419 | 		// SEC-003: Check file size before reading to prevent memory exhaustion
 420 | 		// stats already obtained above
 421 | 		if (stats.size > MAX_FILE_SIZE) {
 422 | 			throw new Error(  <-- UNCOVERED
 423 | 				`File size (${(stats.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
 424 | 			)
 425 | 		}
```

**Conditions to Reach This Line:**

- Line 401: try
- Line 404: if - Condition: `global.__basedir`
- Line 406: else
- Line 412: try
- Line 421: if - Condition: `stats.size > MAX_FILE_SIZE`

**Test Scenario:**

- **Description:** Cover line 422: throw new Error(
- **Setup:**
  - Create conditions that trigger error
  - Ensure condition is true: global.__basedir
  - Ensure condition is true: stats.size > MAX_FILE_SIZE
- **Action:**
  - Execute code that throws
- **Assertions:**
  - Verify error is thrown/caught correctly

### Line 437

**Code:**
```typescript
throw new Error(`YAML parsing ${filePath}: ${warning}`)
```

**Context:**
```typescript
 434 | 			return yaml.load(data, {
 435 | 				schema: yaml.JSON_SCHEMA,
 436 | 				onWarning: (warning) => {
 437 | 					throw new Error(`YAML parsing ${filePath}: ${warning}`)  <-- UNCOVERED
 438 | 				},
 439 | 			})
 440 | 		} else if (convert && filePath.indexOf('.json') !== -1) {
```

**Conditions to Reach This Line:**

- Line 401: try
- Line 404: if - Condition: `global.__basedir`
- Line 406: else
- Line 412: try
- Line 421: if - Condition: `stats.size > MAX_FILE_SIZE`
- Line 430: if - Condition: `convert && filePath.indexOf('.yaml'`

**Test Scenario:**

- **Description:** Cover line 437: throw new Error(`YAML parsing ${filePath}: ${warni...
- **Setup:**
  - Create conditions that trigger error
  - Ensure condition is true: global.__basedir
  - Ensure condition is true: stats.size > MAX_FILE_SIZE
  - Ensure condition is true: convert && filePath.indexOf('.yaml'
- **Action:**
  - Execute code that throws
- **Assertions:**
  - Verify error is thrown/caught correctly

### Line 483

**Code:**
```typescript
throw error
```

**Context:**
```typescript
 480 | 		const parser = getXmlParser()
 481 | 		return parser.parse(data)
 482 | 	} catch (error) {
 483 | 		throw error  <-- UNCOVERED
 484 | 	}
 485 | }
 486 | 
```

**Conditions to Reach This Line:**

- Line 476: try
- Line 482: catch

**Test Scenario:**

- **Description:** Cover line 483: throw error
- **Setup:**
  - Create conditions that trigger error
- **Action:**
  - Execute code that throws
- **Assertions:**
  - Verify error is thrown/caught correctly

### Line 548

**Code:**
```typescript
return nextLevelUp()
```

**Context:**
```typescript
 545 | 			const stats = await fsTmp.promises.stat(file)
 546 | 			if (stats.isFile()) return file
 547 | 			// stat existed, but isFile() returned false
 548 | 			return nextLevelUp()  <-- UNCOVERED
 549 | 		} catch (e) {
 550 | 			// stat did not exist
 551 | 			return nextLevelUp()
```

**Conditions to Reach This Line:**

- Line 544: try
- Line 546: if - Condition: `stats.isFile(`

**Test Scenario:**

- **Description:** Cover line 548: return nextLevelUp()
- **Setup:**
  - Set up conditions for this return path
  - Ensure condition is true: stats.isFile(
- **Action:**
  - Execute function
- **Assertions:**
  - Verify returns: nextLevelUp()

## src/meta/yargs.ts

### Line 44

**Code:**
```typescript
if (option) {
```

**Context:**
```typescript
  41 | 	Object.keys(optionObj).forEach((key) => {
  42 | 		const optionKey = key as keyof YargsOptions
  43 | 		const option = optionObj[optionKey]
  44 | 		if (option) {  <-- UNCOVERED
  45 | 			Object.keys(option).forEach((subKey) => {
  46 | 				const subKeyTyped = subKey as keyof typeof option
  47 | 				const value = option[subKeyTyped]
```

**Conditions to Reach This Line:**

- Line 44: if - Condition: `option`

**Test Scenario:**

- **Description:** Cover line 44: if (option) {
- **Setup:**
  - Ensure condition is true: option

