// Type declarations for marked-terminal
declare module 'marked-terminal' {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const markedTerminal: new () => {
		// Minimal type definition for marked-terminal renderer
		[key: string]: unknown
	}
	export default markedTerminal
}
