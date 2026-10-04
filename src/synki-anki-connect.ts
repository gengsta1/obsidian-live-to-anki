import { requestUrl } from 'obsidian'

export type SynkiConnectSettings = {
	host: string
	key: string | undefined
	port: number
}

export type SynkiNotePayload = {
	deckName: string
	fields: Record<string, string>
	modelName: string
	tags: string[]
}

export type SynkiTemplatePayload = {
	back: string
	css: string
	front: string
	modelName: string
	templateName: string
}

type AnkiConnectResponse<T> = {
	error: null | string
	result: T
}

export class SynkiConnectClient {
	private readonly settings: SynkiConnectSettings

	public constructor(settings: SynkiConnectSettings) {
		this.settings = settings
	}

	public async addNote(note: SynkiNotePayload): Promise<string> {
		await this.createDeck(note.deckName)

		const result = await this.invoke<number>('addNote', {
			note: {
				deckName: note.deckName,
				fields: note.fields,
				modelName: note.modelName,
				tags: note.tags,
			},
		})
		return String(result)
	}

	public async createDeck(deckName: string): Promise<void> {
		await this.invoke('createDeck', { deck: deckName })
	}

	public async deleteDeck(deckName: string): Promise<void> {
		await this.invoke('deleteDecks', { cardsToo: true, decks: [deckName] })
	}

	public async deleteNote(noteId: string): Promise<void> {
		await this.invoke('deleteNotes', { notes: [Number(noteId)] })
	}

	public async findMissingModelFields(modelName: string, requiredFields: string[]): Promise<string[]> {
		const modelFields = await this.invoke<string[]>('modelFieldNames', { modelName })
		const available = new Set(modelFields)
		return requiredFields.filter((field) => !available.has(field))
	}

	public async noteExists(noteId: string): Promise<boolean> {
		const notes = await this.invoke<Array<{ noteId: number }>>('notesInfo', {
			notes: [Number(noteId)],
		})
		return notes.some((note) => String(note.noteId) === noteId)
	}

	public async updateModelTemplate(template: SynkiTemplatePayload): Promise<void> {
		await this.invoke('updateModelTemplates', {
			model: {
				name: template.modelName,
				templates: {
					[template.templateName]: {
						Back: template.back,
						Front: template.front,
					},
				},
			},
		})

		await this.invoke('updateModelStyling', {
			model: {
				css: template.css,
				name: template.modelName,
			},
		})
	}

	public async updateNote(noteId: string, note: SynkiNotePayload): Promise<void> {
		await this.invoke('updateNoteFields', {
			note: {
				fields: note.fields,
				id: Number(noteId),
			},
		})

		await this.invoke('updateNoteTags', {
			note: Number(noteId),
			tags: note.tags.join(' '),
		})
	}

	private async invoke<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
		const response = await requestUrl({
			body: JSON.stringify({
				action,
				key: this.settings.key,
				params,
				version: 6,
			}),
			headers: {
				'Content-Type': 'application/json',
			},
			method: 'POST',
			url: `${this.settings.host}:${String(this.settings.port)}`,
		})

		const payload = response.json as AnkiConnectResponse<T>
		if (payload.error !== null) {
			throw new Error(payload.error)
		}

		return payload.result
	}
}
