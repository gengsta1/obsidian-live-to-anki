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
		console.warn('Medical Anki parser skipped malformed content', {
			errors: parsed.errors,
			path: file.path,
		})
	}

	if (parsed.targetDeck === null || parsed.cards.length === 0) {
		return
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
			return
		}

		new Notice(
			`Medical Anki sync: ${synced.length} note${synced.length === 1 ? '' : 's'} synced to ${parsed.targetDeck}${skipped > 0 ? ` (${skipped} skipped)` : ''}.`,
		)
	}
}
