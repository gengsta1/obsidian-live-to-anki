import { Notice, TFile } from 'obsidian'
import type YankiPlugin from './main'
import { MedicalAnkiConnectClient, type MedicalAnkiNotePayload } from './medical-anki-connect'
import {
	CLOZE_OBSIDIAN_FIELDS,
	DEFAULT_MEDICAL_PARSER_OPTIONS,
	insertSyncedNoteIds,
	parseMedicalAnkiDocument,
	type MedicalParserOptions,
	type ParsedMedicalCardBlock,
} from './medical-parser'

export type MedicalSyncFileResult = {
	deckName: null | string
	filePath: string
	skipped: number
	synced: number
}

export async function syncCurrentMedicalNote(plugin: YankiPlugin): Promise<void> {
	try {
		const file = plugin.app.workspace.getActiveFile()
		if (file === null) {
			new Notice('No active markdown file.')
			return
		}

		await syncMedicalFile(plugin, file, true)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error('Medical Anki sync failed', error)
		new Notice(`Medical Anki sync failed: ${message}`, 10_000)
	}
}

export async function syncMainNotesMedicalAnki(plugin: YankiPlugin): Promise<void> {
	try {
		const folders = getMedicalAnkiFolders(plugin)
		const files = plugin.app.vault
			.getMarkdownFiles()
			.filter((file) => folders.some((folder) => isFileInFolder(file.path, folder)))

		let synced = 0
		let skipped = 0
		let touchedFiles = 0

		for (const file of files) {
			const result = await syncMedicalFile(plugin, file)
			synced += result.synced
			skipped += result.skipped
			if (result.synced > 0 || result.skipped > 0) {
				touchedFiles += 1
			}
		}

		new Notice(
			`Medical Anki sync: ${synced} note${synced === 1 ? '' : 's'} synced from ${folders.length} folder${folders.length === 1 ? '' : 's'}${skipped > 0 ? ` (${skipped} skipped)` : ''}.`,
			10_000,
		)

		console.info('Medical Anki Main Notes sync complete', {
			filesScanned: files.length,
			skipped,
			synced,
			touchedFiles,
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error('Medical Anki Main Notes sync failed', error)
		new Notice(`Medical Anki sync failed: ${message}`, 10_000)
	}
}

export async function syncMedicalFile(
	plugin: YankiPlugin,
	file: TFile,
	showSuccessNotice = false,
): Promise<MedicalSyncFileResult> {
	if (file.extension !== 'md') {
		return emptyResult(file.path)
	}

	const markdown = await plugin.app.vault.read(file)
	if (!/^## Anki\s*$/imu.test(markdown)) {
		return emptyResult(file.path)
	}

	const options = getMedicalParserOptions(plugin)
	const parsed = parseMedicalAnkiDocument(markdown, options)
	if (parsed.errors.length > 0) {
		console.warn('Medical Anki parser skipped malformed content', {
			errors: parsed.errors,
			path: file.path,
		})
	}

	if (parsed.targetDeck === null || parsed.cards.length === 0) {
		return emptyResult(file.path)
	}

	const client = new MedicalAnkiConnectClient(plugin.settings.ankiConnect)
	const synced: { card: ParsedMedicalCardBlock; noteId: string }[] = []
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

			const payload: MedicalAnkiNotePayload = {
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
			console.warn('Medical Anki card skipped', {
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
			`Medical Anki sync: ${synced.length} note${synced.length === 1 ? '' : 's'} synced to ${parsed.targetDeck}${skipped > 0 ? ` (${skipped} skipped)` : ''}.`,
		)
	}

	return {
		deckName: parsed.targetDeck,
		filePath: file.path,
		skipped,
		synced: synced.length,
	}
}

function getMedicalAnkiFolders(plugin: YankiPlugin): string[] {
	const folders = plugin.settings.medicalAnki.folders
		.map((folder) => folder.trim().replaceAll(/\/+$/gu, ''))
		.filter(Boolean)
	return folders.length === 0 ? ['6 - Main Notes'] : folders
}

function getMedicalParserOptions(plugin: YankiPlugin): MedicalParserOptions {
	const fields = splitLines(plugin.settings.medicalAnki.fields)
	return {
		defaultModelName:
			plugin.settings.medicalAnki.defaultModelName.trim() ||
			DEFAULT_MEDICAL_PARSER_OPTIONS.defaultModelName,
		fieldAliases: {
			...DEFAULT_MEDICAL_PARSER_OPTIONS.fieldAliases,
			...parseAliasMap(plugin.settings.medicalAnki.fieldAliases),
		},
		fields: fields.length > 0 ? fields : CLOZE_OBSIDIAN_FIELDS,
		modelAliases: {
			...DEFAULT_MEDICAL_PARSER_OPTIONS.modelAliases,
			...parseAliasMap(plugin.settings.medicalAnki.modelAliases),
		},
		textFieldName:
			plugin.settings.medicalAnki.textFieldName.trim() ||
			DEFAULT_MEDICAL_PARSER_OPTIONS.textFieldName,
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

function emptyResult(filePath: string): MedicalSyncFileResult {
	return {
		deckName: null,
		filePath,
		skipped: 0,
		synced: 0,
	}
}
