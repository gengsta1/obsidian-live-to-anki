import { requestUrl } from 'obsidian'

export type MedicalAnkiConnectSettings = {
	host: string
	key: string | undefined
	port: number
}

export type MedicalAnkiNotePayload = {
	deckName: string
	fields: Record<string, string>
	modelName: string
	tags: string[]
}

type AnkiConnectResponse<T> = {
	error: null | string
	result: T
}

export class MedicalAnkiConnectClient {
	private readonly settings: MedicalAnkiConnectSettings

	public constructor(settings: MedicalAnkiConnectSettings) {
		this.settings = settings
	}

	public async addNote(note: MedicalAnkiNotePayload): Promise<string> {
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

	public async findMissingModelFields(modelName: string, requiredFields: string[]): Promise<string[]> {
		const modelFields = await this.invoke<string[]>('modelFieldNames', { modelName })
		const available = new Set(modelFields)
		return requiredFields.filter((field) => !available.has(field))
	}

	public async updateNote(noteId: string, note: MedicalAnkiNotePayload): Promise<void> {
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
