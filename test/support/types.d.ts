import type YankiPlugin from '../../src/main'
import type { AnkiConnection } from './anki'

declare module 'wdio-obsidian-service' {
	interface InstalledPlugins {
		'obsidian-live-to-anki': YankiPlugin
		obsidianLiveToAnki: YankiPlugin
		yanki: YankiPlugin
	}
}

declare module 'vitest' {
	interface ProvidedContext {
		anki: AnkiConnection
	}
}
