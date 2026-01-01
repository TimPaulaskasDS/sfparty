// Type definitions for blessed (neo-blessed is no longer used)
declare module 'blessed' {
	export interface Widgets {
		Screen: {
			width?: number
			height?: number
			key: (keys: string[], handler: () => void) => void
			on: (event: string, handler: () => void) => void
			removeListener: (event: string, handler: () => void) => void
			removeAllListeners: () => void
			render: () => void
			input?: {
				pause?: () => void
				resume?: () => void
			}
		}
		Box: {
			setContent: (content: string) => void
		}
		List: {
			setItems: (items: string[]) => void
		}
		Log: {
			log: (message: string) => void
		}
		Node: unknown
	}

	export interface ScreenOptions {
		smartCSR?: boolean
		title?: string
		fullUnicode?: boolean
		cursor?: {
			artificial?: boolean
			shape?: string
			blink?: boolean
		}
	}

	export function screen(options: ScreenOptions): Widgets.Screen
	export const box: unknown
	export const list: unknown
	export const log: unknown

	const blessed: {
		screen: (options: ScreenOptions) => Widgets.Screen
		box: unknown
		list: unknown
		log: unknown
	}
	export default blessed
}

declare module 'blessed-contrib' {
	import type { Widgets } from 'blessed'

	export interface GridOptions {
		screen: Widgets.Screen
		rows: number
		cols: number
	}

	export interface LogOptions {
		fg?: string
		selectedFg?: string
	}

	export class grid {
		constructor(options: GridOptions)
		set<T>(
			row: number,
			col: number,
			rowSpan: number,
			colSpan: number,
			widget: unknown,
			options?: Record<string, unknown>,
		): T
	}

	export class log {
		constructor(options: LogOptions)
		log(message: string): void
	}

	const contrib: {
		grid: new (options: GridOptions) => grid
		log: new (options: LogOptions) => log
	}
	export default contrib
}
