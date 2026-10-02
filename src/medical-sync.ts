import { Notice, TFile } from 'obsidian'
import type YankiPlugin from './main'
import { MedicalAnkiConnectClient, type MedicalAnkiNotePayload } from './medical-anki-connect'
import {
	CLOZE_OBSIDIAN_FIELDS,
	insertSyncedNoteIds,
	parseMedicalAnkiDocument,
	type ParsedMedicalCardBlock,
} from './medical-parser'

export type MedicalSyncFileResult = {
	deckName: null | string
	filePath: string
	skipped: number
	synced: number
}

const MAIN_NOTES_FOLDER = '6 - Main Notes/'

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
		const files = plugin.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith(MAIN_NOTES_FOLDER))

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
			`Medical Anki sync: ${synced} note${synced === 1 ? '' : 's'} synced from Main Notes${skipped > 0 ? ` (${skipped} skipped)` : ''}.`,
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

	const parsed = parseMedicalAnkiDocument(markdown)
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
		const modelName = card.modelName || 'Cloze_obsidian'
		const requiredFields = modelName === 'Cloze_obsidian' ? CLOZE_OBSIDIAN_FIELDS : Object.keys(card.fields)

		try {
			if ((card.fields.Text?.trim() ?? '').length === 0) {
				throw new Error(`Card block for '${modelName}' has no Text field.`)
			}

			const missing = await client.findMissingModelFields(modelName, requiredFields)
			if (missing.length > 0) {
				throw new Error(`Model '${modelName}' lacks field '${missing[0]}'.`)
			}

			const payload: MedicalAnkiNotePayload = {
				deckName: parsed.targetDeck,
				fields: card.fields,
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

function emptyResult(filePath: string): MedicalSyncFileResult {
	return {
		deckName: null,
		filePath,
		skipped: 0,
		synced: 0,
	}
}
