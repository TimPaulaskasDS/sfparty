/**
 * Real split -> combine round-trip integration tests.
 *
 * Unlike combine.test.ts (which mocks fileUtils), these run the real Split and
 * Combine against fixtures on a temp filesystem and assert that combine rebuilds
 * the same metadata that split consumed. This is the genuine safety net for
 * round-trip fidelity.
 */

import { XMLParser } from 'fast-xml-parser'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import * as labelDefinition from '../../src/meta/CustomLabels.js'
import * as permsetDefinition from '../../src/meta/PermissionSets.js'
import * as profileDefinition from '../../src/meta/Profiles.js'
import * as workflowDefinition from '../../src/meta/Workflows.js'
import {
	cleanupRoundTrip,
	type RoundTripResult,
	roundTrip,
} from '../helpers/roundTrip.js'

const DATA = path.join(process.cwd(), 'test/data')

const parser = new XMLParser({
	ignoreAttributes: false,
	attributesGroupName: '$',
	attributeNamePrefix: '',
	ignoreDeclaration: true,
	trimValues: true,
	parseAttributeValue: false,
	parseTagValue: false,
})

/** Recursively sort object keys and arrays so comparison ignores ordering. */
function normalize(value: unknown): unknown {
	if (Array.isArray(value)) {
		const items = value.map(normalize)
		return items
			.slice()
			.sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1))
	}
	if (value && typeof value === 'object') {
		const obj = value as Record<string, unknown>
		const sorted: Record<string, unknown> = {}
		for (const key of Object.keys(obj).sort()) {
			sorted[key] = normalize(obj[key])
		}
		return sorted
	}
	return value
}

function semantic(xml: string): unknown {
	return normalize(parser.parse(xml))
}

let active: RoundTripResult | undefined

afterEach(() => {
	if (active) {
		cleanupRoundTrip(active)
		active = undefined
	}
})

const cases: Array<{ name: string; fixture: string; definition: unknown }> = [
	{
		name: 'CustomLabels',
		fixture: 'labels/CustomLabels.labels-meta.xml',
		definition: labelDefinition.metadataDefinition,
	},
	{
		name: 'Workflow',
		fixture: 'workflows/Case.workflow-meta.xml',
		definition: workflowDefinition.metadataDefinition,
	},
	{
		name: 'Profile',
		fixture: 'profiles/Admin.profile-meta.xml',
		definition: profileDefinition.metadataDefinition,
	},
	{
		name: 'PermissionSet',
		fixture: 'permissionsets/Test.permissionset-meta.xml',
		definition: permsetDefinition.metadataDefinition,
	},
]

describe('split -> combine round-trip', () => {
	for (const { name, fixture, definition } of cases) {
		it(`${name}: rebuilds the same metadata`, async () => {
			active = await roundTrip(
				path.join(DATA, fixture),
				definition as Parameters<typeof roundTrip>[1],
			)
			expect(active.splitOk).toBe(true)
			expect(active.combineResult).toBe(true)
			expect(active.outputXml.length).toBeGreaterThan(0)
			expect(semantic(active.outputXml)).toEqual(
				semantic(active.inputXml),
			)
		})
	}

	it('Workflow: single-element repeatables survive', async () => {
		active = await roundTrip(
			path.join(DATA, 'workflows/SingleElementArray.workflow-meta.xml'),
			workflowDefinition.metadataDefinition,
		)
		expect(active.splitOk).toBe(true)
		expect(active.combineResult).toBe(true)
		expect(semantic(active.outputXml)).toEqual(semantic(active.inputXml))
	})
})

describe('combine git modes', () => {
	it('git-enabled: records the item as a package.xml member', async () => {
		active = await roundTrip(
			path.join(DATA, 'profiles/Admin.profile-meta.xml'),
			profileDefinition.metadataDefinition,
			{ git: { enabled: true } },
		)
		expect(active.combineResult).toBe(true)
		expect(semantic(active.outputXml)).toEqual(semantic(active.inputXml))

		const added = active.addPkg.packageJSON?.Package.types?.find(
			(t) => t.name === 'Profile',
		)
		expect(added?.members).toContain('Admin')
		expect(active.desPkg.packageJSON?.Package.types ?? []).toHaveLength(0)
	})

	it('delta mode: combines only the git-changed files', async () => {
		const added = [
			'labels/ACE_CompetitiveDetails.yaml',
			'labels/AE_Direct.yaml',
		]
		active = await roundTrip(
			path.join(DATA, 'labels/CustomLabels.labels-meta.xml'),
			labelDefinition.metadataDefinition,
			{ git: { enabled: true, delta: true }, deltaAddFiles: added },
		)
		// guard: the picked files really are part of the split output
		for (const f of added) expect(active.splitFiles).toContain(f)

		const parsed = parser.parse(active.outputXml) as {
			CustomLabels: { labels?: unknown }
		}
		const labels = parsed.CustomLabels.labels
		const arr = Array.isArray(labels)
			? labels
			: labels !== undefined
				? [labels]
				: []
		// the fixture has 10 labels; delta scoped combine to the 2 changed ones
		expect(arr).toHaveLength(2)
	})

	it('source-not-found: removes the XML and records a destructive change', async () => {
		active = await roundTrip(
			path.join(DATA, 'profiles/Admin.profile-meta.xml'),
			profileDefinition.metadataDefinition,
			{ git: { enabled: true }, deleteSplitFiles: ['main.yaml'] },
		)
		expect(active.combineResult).not.toBe(true)
		expect(active.outputXml).toBe('')

		const removed = active.desPkg.packageJSON?.Package.types?.find(
			(t) => t.name === 'Profile',
		)
		expect(removed?.members).toContain('Admin')
	})
})
