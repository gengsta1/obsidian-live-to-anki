import type SynkiPlugin from '../../src/main'
import type { AnkiConnection } from './anki'

declare module 'wdio-obsidian-service' {
	interface InstalledPlugins {
		synki: SynkiPlugin
	}
}

declare module 'vitest' {
	interface ProvidedContext {
		anki: AnkiConnection
	}
}
