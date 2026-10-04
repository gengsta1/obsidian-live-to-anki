import { Notice, TFile } from 'obsidian'
import type SynkiPlugin from './main'
import { SynkiConnectClient, type SynkiNotePayload } from './synki-anki-connect'
import {
	CLOZE_OBSIDIAN_FIELDS,
	DEFAULT_SYNKI_PARSER_OPTIONS,
	insertSyncedNoteIds,
	parseSynkiDocument,
	type SynkiParserOptions,
	type ParsedSynkiCardBlock,
} from './synki-parser'

export type SynkiSyncFileResult = {
	deckName: null | string
	filePath: string
	skipped: number
	synced: number
}

export async function syncCurrentSynkiNote(plugin: SynkiPlugin): Promise<void> {
	try {
		const file = plugin.app.workspace.getActiveFile()
		if (file === null) {
			new Notice('No active markdown file.')
			return
		}

		await syncSynkiFile(plugin, file, true)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error('Synki sync failed', error)
		new Notice(`Synki sync failed: ${message}`, 10_000)
	}
}

export async function syncMainNotesSynki(plugin: SynkiPlugin): Promise<void> {
	try {
		const folders = getSynkiFolders(plugin)
		const files = plugin.app.vault
			.getMarkdownFiles()
			.filter((file) => folders.some((folder) => isFileInFolder(file.path, folder)))

		let synced = 0
		let skipped = 0
		let touchedFiles = 0

		for (const file of files) {
			const result = await syncSynkiFile(plugin, file)
			synced += result.synced
			skipped += result.skipped
			if (result.synced > 0 || result.skipped > 0) {
				touchedFiles += 1
			}
		}

		new Notice(
			`Synki sync: ${synced} note${synced === 1 ? '' : 's'} synced from ${folders.length} folder${folders.length === 1 ? '' : 's'}${skipped > 0 ? ` (${skipped} skipped)` : ''}.`,
			10_000,
		)

	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error('Synki Main Notes sync failed', error)
		new Notice(`Synki sync failed: ${message}`, 10_000)
	}
}

export async function syncSynkiFile(
	plugin: SynkiPlugin,
	file: TFile,
	showSuccessNotice = false,
): Promise<SynkiSyncFileResult> {
	if (file.extension !== 'md') {
		return emptyResult(file.path)
	}

	const markdown = await plugin.app.vault.read(file)
	if (!/^## Anki\s*$/imu.test(markdown)) {
		return emptyResult(file.path)
	}

	const options = getSynkiParserOptions(plugin)
	const parsed = parseSynkiDocument(markdown, options)
	if (parsed.errors.length > 0) {
		console.warn('Synki parser skipped malformed content', {
			errors: parsed.errors,
			path: file.path,
		})
	}

	if (parsed.targetDeck === null || parsed.cards.length === 0) {
		return emptyResult(file.path)
	}

	const client = new SynkiConnectClient(plugin.settings.ankiConnect)
	const synced: { card: ParsedSynkiCardBlock; noteId: string }[] = []
	let skipped = 0

	for (const card of parsed.cards) {
		const modelName = card.modelName || options.defaultModelName
		const requiredFields = modelName === options.defaultModelName ? options.fields : Object.keys(card.fields)

		try {
			if ((card.fields[options.textFieldName]?.trim() ?? '').length === 0) {
				throw new Error(`Card block for '${modelName}' has no ${options.textFieldName} field.`)
			}

			const missing = await client.findMissingModelFields(modelName, requiredFields)
			if (missing.length > 0) {
				throw new Error(`Model '${modelName}' lacks field '${missing[0]}'.`)
			}

			const payload: SynkiNotePayload = {
				deckName: parsed.targetDeck,
				fields: renderFieldsForAnki(card.fields),
				modelName,
				tags: [...new Set([...parsed.fileTags, ...card.tags])],
			}

			if (card.noteId === null) {
				const noteId = await client.addNote(payload)
				synced.push({ card, noteId })
			} else {
				await client.updateNote(card.noteId, payload)
				synced.push({ card, noteId: card.noteId })
			}
		} catch (error) {
			skipped += 1
			console.warn('Synki card skipped', {
				error,
				modelName,
				path: file.path,
				text: card.fields.Text,
			})
		}
	}

	const withIds = insertSyncedNoteIds(markdown, synced)
	if (withIds !== markdown) {
		await plugin.app.vault.modify(file, withIds)
	}

	if (showSuccessNotice || plugin.settings.verboseNotices) {
		if (synced.length === 0 && skipped === 0) {
			return {
				deckName: parsed.targetDeck,
				filePath: file.path,
				skipped,
				synced: synced.length,
			}
		}

		new Notice(
			`Synki sync: ${synced.length} note${synced.length === 1 ? '' : 's'} synced to ${parsed.targetDeck}${skipped > 0 ? ` (${skipped} skipped)` : ''}.`,
		)
	}

	return {
		deckName: parsed.targetDeck,
		filePath: file.path,
		skipped,
		synced: synced.length,
	}
}

function getSynkiFolders(plugin: SynkiPlugin): string[] {
	const folders = plugin.settings.synki.folders
		.map((folder) => folder.trim().replaceAll(/\/+$/gu, ''))
		.filter(Boolean)
	return folders.length === 0 ? ['6 - Main Notes'] : folders
}

function getSynkiParserOptions(plugin: SynkiPlugin): SynkiParserOptions {
	const fields = splitLines(plugin.settings.synki.fields)
	return {
		defaultModelName:
			plugin.settings.synki.defaultModelName.trim() ||
			DEFAULT_SYNKI_PARSER_OPTIONS.defaultModelName,
		fieldAliases: {
			...DEFAULT_SYNKI_PARSER_OPTIONS.fieldAliases,
			...parseAliasMap(plugin.settings.synki.fieldAliases),
		},
		fields: fields.length > 0 ? fields : CLOZE_OBSIDIAN_FIELDS,
		modelAliases: {
			...DEFAULT_SYNKI_PARSER_OPTIONS.modelAliases,
			...parseAliasMap(plugin.settings.synki.modelAliases),
		},
		textFieldName:
			plugin.settings.synki.textFieldName.trim() ||
			DEFAULT_SYNKI_PARSER_OPTIONS.textFieldName,
	}
}

function isFileInFolder(filePath: string, folder: string): boolean {
	return filePath === folder || filePath.startsWith(`${folder}/`)
}

function parseAliasMap(input: string): Record<string, string> {
	const aliases: Record<string, string> = {}
	for (const line of splitLines(input)) {
		const separatorIndex = line.indexOf('=')
		if (separatorIndex < 0) {
			continue
		}

		const alias = normalizeAliasKey(line.slice(0, separatorIndex))
		const target = line.slice(separatorIndex + 1).trim()
		if (alias.length > 0 && target.length > 0) {
			aliases[alias] = target
		}
	}

	return aliases
}

function renderFieldsForAnki(fields: Record<string, string>): Record<string, string> {
	return Object.fromEntries(
		Object.entries(fields).map(([field, value]) => [field, renderInlineMarkdown(value)]),
	)
}

function renderInlineMarkdown(value: string): string {
	return value.replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/gu, '<strong>$1</strong>')
}

function normalizeAliasKey(input: string): string {
	return input.toLowerCase().replaceAll(/\s+/gu, ' ').trim()
}

function splitLines(input: string): string[] {
	return input
		.split(/\r?\n/gu)
		.map((line) => line.trim())
		.filter(Boolean)
}

function emptyResult(filePath: string): SynkiSyncFileResult {
	return {
		deckName: null,
		filePath,
		skipped: 0,
		synced: 0,
	}
}
