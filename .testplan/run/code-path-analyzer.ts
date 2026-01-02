#!/usr/bin/env bun
/**
 * Code Path Analyzer
 *
 * Analyzes uncovered lines and determines the exact conditions needed to reach them.
 * This does deep code path analysis by:
 * 1. Reading the source code for each uncovered line
 * 2. Analyzing control flow (if/else, try/catch, loops, etc.)
 * 3. Tracing back through call chains
 * 4. Identifying required inputs, state, and conditions
 * 5. Generating specific test scenarios
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../..')

interface Condition {
	type: 'if' | 'else' | 'elseif' | 'try' | 'catch' | 'loop'
	condition?: string | null
	depth: number
	line: number
	variable?: string
}

interface Context {
	before: Array<{ num: number; code: string }>
	current: { num: number; code: string }
	after: Array<{ num: number; code: string }>
}

interface TestScenario {
	description: string
	setup: string[]
	action: string[]
	assertions: string[]
}

interface UncoveredLine {
	line: number
	code: string
	context: Context
	conditions: Condition[]
	callChain: Array<{ function: string; line: number }>
	testScenario: TestScenario
}

interface FileAnalysis {
	file: string
	uncoveredLines: UncoveredLine[]
}

// Read coverage data
const coverageFile = path.join(projectRoot, 'coverage/coverage-final.json')
const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'))

// Read source files and analyze uncovered lines
function analyzeUncoveredLines(
	filePath: string,
	uncoveredLines: number[],
): FileAnalysis | null {
	const fullPath = path.join(projectRoot, filePath)
	if (!fs.existsSync(fullPath)) {
		return null
	}

	const source = fs.readFileSync(fullPath, 'utf8')
	const lines = source.split('\n')

	const analysis: FileAnalysis = {
		file: filePath,
		uncoveredLines: [],
	}

	for (const lineNum of uncoveredLines) {
		const lineIndex = lineNum - 1
		if (lineIndex < 0 || lineIndex >= lines.length) continue

		const line = lines[lineIndex]
		const context = getContext(lines, lineIndex)

		analysis.uncoveredLines.push({
			line: lineNum,
			code: line.trim(),
			context: context,
			conditions: analyzeConditions(lines, lineIndex),
			callChain: traceCallChain(lines, lineIndex),
			testScenario: generateTestScenario(lines, lineIndex, context),
		})
	}

	return analysis
}

function getContext(
	lines: string[],
	lineIndex: number,
	contextSize = 10,
): Context {
	const start = Math.max(0, lineIndex - contextSize)
	const end = Math.min(lines.length, lineIndex + contextSize + 1)
	return {
		before: lines.slice(start, lineIndex).map((l, i) => ({
			num: start + i + 1,
			code: l,
		})),
		current: {
			num: lineIndex + 1,
			code: lines[lineIndex],
		},
		after: lines.slice(lineIndex + 1, end).map((l, i) => ({
			num: lineIndex + 2 + i,
			code: l,
		})),
	}
}

function analyzeConditions(lines: string[], lineIndex: number): Condition[] {
	const conditions: Condition[] = []
	let depth = 0

	// Walk backwards to find all conditions
	for (let i = lineIndex; i >= 0; i--) {
		const line = lines[i]

		// Track if/else/elseif
		if (line.match(/^\s*if\s*\(/)) {
			const condition = extractCondition(line)
			conditions.push({
				type: 'if',
				condition: condition,
				depth: depth,
				line: i + 1,
			})
			depth++
		} else if (
			line.match(/^\s*else\s*\{/) ||
			line.match(/^\s*\}\s*else\s*\{/)
		) {
			conditions.push({
				type: 'else',
				depth: depth - 1,
				line: i + 1,
			})
		} else if (line.match(/^\s*else\s+if\s*\(/)) {
			const condition = extractCondition(line)
			conditions.push({
				type: 'elseif',
				condition: condition,
				depth: depth - 1,
				line: i + 1,
			})
		}

		// Track try/catch
		if (line.match(/^\s*try\s*\{/)) {
			conditions.push({
				type: 'try',
				depth: depth,
				line: i + 1,
			})
		} else if (line.match(/^\s*\}\s*catch\s*\(/)) {
			const catchVar = line.match(/catch\s*\(([^)]+)\)/)?.[1]
			conditions.push({
				type: 'catch',
				variable: catchVar,
				depth: depth,
				line: i + 1,
			})
		}

		// Track loops
		if (line.match(/^\s*(for|while|do)\s*\(/)) {
			const loopCondition = extractCondition(line)
			conditions.push({
				type: 'loop',
				condition: loopCondition,
				depth: depth,
				line: i + 1,
			})
			depth++
		}

		// Stop at function boundaries
		if (
			line.match(
				/^\s*(function|async\s+function|export\s+(function|async|const|let|class))/,
			)
		) {
			break
		}
	}

	return conditions.reverse()
}

function extractCondition(line: string): string | null {
	// Extract condition from if/while/for statements
	const match = line.match(/\(([^)]+)\)/)
	return match ? match[1].trim() : null
}

function traceCallChain(
	lines: string[],
	lineIndex: number,
): Array<{ function: string; line: number }> {
	const callChain: Array<{ function: string; line: number }> = []

	// Find the function this line is in
	let functionName: string | null = null
	let functionStart = lineIndex

	for (let i = lineIndex; i >= 0; i--) {
		const line = lines[i]
		const funcMatch = line.match(
			/(?:export\s+)?(?:async\s+)?(?:function\s+)?(\w+)\s*[=:\(]/,
		)
		if (funcMatch) {
			functionName = funcMatch[1]
			functionStart = i
			break
		}
	}

	if (functionName) {
		callChain.push({
			function: functionName,
			line: functionStart + 1,
		})
	}

	return callChain
}

function generateTestScenario(
	lines: string[],
	lineIndex: number,
	context: Context,
): TestScenario {
	const line = lines[lineIndex].trim()
	const conditions = analyzeConditions(lines, lineIndex)

	const scenario: TestScenario = {
		description: `Cover line ${lineIndex + 1}: ${line.substring(0, 50)}${line.length > 50 ? '...' : ''}`,
		setup: [],
		action: [],
		assertions: [],
	}

	// Analyze what's needed based on the line content
	if (line.includes('cache')) {
		if (line.includes('.get(')) {
			scenario.setup.push('Populate cache with the value first')
			scenario.action.push('Call function again with same input')
			scenario.assertions.push('Verify cache hit occurs')
		} else if (line.includes('.set(')) {
			scenario.setup.push('Ensure cache is empty')
			scenario.action.push(
				'Call function with input that triggers cache set',
			)
			scenario.assertions.push('Verify value is cached')
		}
	}

	if (line.includes('undefined')) {
		scenario.setup.push('Set variable to undefined')
		scenario.action.push('Execute code path that checks for undefined')
		scenario.assertions.push('Verify undefined case is handled')
	}

	if (line.includes('throw') || line.includes('Error')) {
		scenario.setup.push('Create conditions that trigger error')
		scenario.action.push('Execute code that throws')
		scenario.assertions.push('Verify error is thrown/caught correctly')
	}

	if (line.includes('return')) {
		const returnValue = line.match(/return\s+(.+)/)?.[1]
		scenario.setup.push('Set up conditions for this return path')
		scenario.action.push('Execute function')
		scenario.assertions.push(`Verify returns: ${returnValue || 'value'}`)
	}

	// Add conditions to setup
	conditions.forEach((cond) => {
		if (cond.condition) {
			scenario.setup.push(`Ensure condition is true: ${cond.condition}`)
		}
	})

	return scenario
}

// Main analysis
const filesToAnalyze: Array<{ file: string; lines: number[] }> = [
	{ file: 'src/lib/pathUtils.ts', lines: [13, 28] },
	{
		file: 'src/lib/packageUtil.ts',
		lines: [152, 153, 154, 155, 156, 247, 248, 322],
	},
	{
		file: 'src/lib/performanceLogger.ts',
		lines: [71, 123, 309, 328, 375, 381],
	},
	{ file: 'src/lib/writeBatcher.ts', lines: [107, 108, 109, 154] },
	{
		file: 'src/lib/fileUtils.ts',
		lines: [
			16, 23, 30, 41, 48, 49, 92, 99, 199, 284, 306, 327, 372, 422, 437,
			483, 548,
		],
	},
	{ file: 'src/meta/yargs.ts', lines: [44] },
]

const results: FileAnalysis[] = []

for (const { file, lines } of filesToAnalyze) {
	const analysis = analyzeUncoveredLines(file, lines)
	if (analysis) {
		results.push(analysis)
	}
}

// Output results
const outputFile = path.join(__dirname, 'CODE_PATH_ANALYSIS.md')
let output = '# Code Path Analysis\n\n'
output +=
	'This document provides detailed code path analysis for each uncovered line.\n'
output += 'It identifies the exact conditions needed to reach each line.\n\n'

for (const analysis of results) {
	output += `## ${analysis.file}\n\n`

	for (const item of analysis.uncoveredLines) {
		output += `### Line ${item.line}\n\n`
		output += `**Code:**\n\`\`\`typescript\n${item.code}\n\`\`\`\n\n`

		output += `**Context:**\n\`\`\`typescript\n`
		item.context.before.slice(-3).forEach((l) => {
			output += `${l.num.toString().padStart(4, ' ')} | ${l.code}\n`
		})
		output += `${item.context.current.num.toString().padStart(4, ' ')} | ${item.context.current.code}  <-- UNCOVERED\n`
		item.context.after.slice(0, 3).forEach((l) => {
			output += `${l.num.toString().padStart(4, ' ')} | ${l.code}\n`
		})
		output += `\`\`\`\n\n`

		if (item.conditions.length > 0) {
			output += `**Conditions to Reach This Line:**\n\n`
			item.conditions.forEach((cond) => {
				output += `- Line ${cond.line}: ${cond.type}`
				if (cond.condition) {
					output += ` - Condition: \`${cond.condition}\``
				}
				output += `\n`
			})
			output += `\n`
		}

		output += `**Test Scenario:**\n\n`
		output += `- **Description:** ${item.testScenario.description}\n`
		if (item.testScenario.setup.length > 0) {
			output += `- **Setup:**\n`
			item.testScenario.setup.forEach((s) => (output += `  - ${s}\n`))
		}
		if (item.testScenario.action.length > 0) {
			output += `- **Action:**\n`
			item.testScenario.action.forEach((a) => (output += `  - ${a}\n`))
		}
		if (item.testScenario.assertions.length > 0) {
			output += `- **Assertions:**\n`
			item.testScenario.assertions.forEach(
				(a) => (output += `  - ${a}\n`),
			)
		}
		output += `\n`
	}
}

fs.writeFileSync(outputFile, output)
console.log(`Code path analysis written to ${outputFile}`)
