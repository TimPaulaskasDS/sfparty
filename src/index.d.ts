// Type declarations for pkgObj.cjs
declare module './lib/pkgObj.cjs' {
	const pkgObj: {
		version: string
		description: string
		name: string
	}
	export default pkgObj
}

// Type declarations for marked-terminal
declare module 'marked-terminal' {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const markedTerminal: new () => {
		// Minimal type definition for marked-terminal renderer
		[key: string]: unknown
	}
	export default markedTerminal
}
