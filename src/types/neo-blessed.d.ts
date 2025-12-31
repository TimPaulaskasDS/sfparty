// Type definitions for blessed (neo-blessed is no longer used)
declare module 'blessed' {
	export = any
}

declare module 'blessed-contrib' {
	import { Screen } from 'blessed'

	export interface GridOptions {
		screen: Screen
		rows: number
		cols: number
	}

	export class grid {
		constructor(options: GridOptions)
		set<T>(
			row: number,
			col: number,
			rowSpan: number,
			colSpan: number,
			widget: any,
			options?: any,
		): T
	}

	export class log {
		constructor(options: any)
		log(message: string): void
	}
}
