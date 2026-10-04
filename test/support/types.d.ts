import type ObsyankiPlugin from '../../src/main'
import type { AnkiConnection } from './anki'

declare module 'wdio-obsidian-service' {
	interface InstalledPlugins {
		obsyanki: ObsyankiPlugin
	}
}

declare module 'vitest' {
	interface ProvidedContext {
		anki: AnkiConnection
	}
}
