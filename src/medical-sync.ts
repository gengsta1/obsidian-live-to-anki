import { Notice, TFile } from 'obsidian'
import type YankiPlugin from './main'
import { MedicalAnkiConnectClient, type MedicalAnkiNotePayload } from './medical-anki-connect'
import {
	CLOZE_OBSIDIAN_FIELDS,
	insertSyncedNoteIds,
	parseMedicalAnkiDocument,
	type ParsedMedicalCardBlock,
} from './medical-parser'

export async function syncCurrentMedicalNote(plugin: YankiPlugin): Promise<void> {
	const file = plugin.app.workspace.getActiveFile()
	if (file === null) {
		new Notice('No active Markdown file.')
		return
	}

	await syncMedicalFile(plugin, file, true)
}

export async function syncMedicalFile(
	plugin: YankiPlugin,
	file: TFile,
	showSuccessNotice = false,
): Promise<void> {
	if (file.extension !== 'md') {
		return
	}

	const markdown = await plugin.app.vault.read(file)
	if (!/^## Anki\s*$/imu.test(markdown)) {
		return
	}

	const parsed = parseMedicalAnkiDocument(markdown)
	if (parsed.errors.length > 0) {
		new Notice(`Medical Anki sync stopped: ${parsed.errors[0]}`)
		console.warn('Medical Anki parser errors', parsed.errors)
		return
	}

	if (parsed.targetDeck === null) {
		new Notice('Medical Anki sync stopped: TARGET DECK missing.')
		return
	}

	const client = new MedicalAnkiConnectClient(plugin.settings.ankiConnect)
	const synced: { card: ParsedMedicalCardBlock; noteId: string }[] = []

	for (const card of parsed.cards) {
		const modelName = card.modelName || 'Cloze_obsidian'
		const requiredFields = modelName === 'Cloze_obsidian' ? CLOZE_OBSIDIAN_FIELDS : Object.keys(card.fields)
		const missing = await client.findMissingModelFields(modelName, requiredFields)
		if (missing.length > 0) {
			new Notice(`Medical Anki sync stopped: model '${modelName}' lacks field '${missing[0]}'.`)
			return
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
	}

	const withIds = insertSyncedNoteIds(markdown, synced)
	if (withIds !== markdown) {
		await plugin.app.vault.modify(file, withIds)
	}

	if (showSuccessNotice || plugin.settings.verboseNotices) {
		new Notice(`Medical Anki sync: ${synced.length} note${synced.length === 1 ? '' : 's'} synced.`)
	}
}
