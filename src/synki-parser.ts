export type ParsedSynkiDocument = {
	ankiSection: string
	cards: ParsedSynkiCardBlock[]
	errors: string[]
	fileTags: string[]
	targetDeck: null | string
}

export type ParsedSynkiCardBlock = {
	endOffset: number
	fields: Record<string, string>
	modelName: string
	noteId: null | string
	raw: string
	startOffset: number
	tags: string[]
}

export type SynkiParserOptions = {
	defaultModelName: string
	fieldAliases: Record<string, string>
	fields: string[]
	modelAliases: Record<string, string>
	textFieldName: string
}

type FieldSpan = {
	lineStart: number
	name: string
	valueStart: number
}

const ANKI_HEADER_RE = /^## Anki\s*$/imu
const BLOCK_RE = /^START\s*\n([\s\S]*?)^END\s*$(?:\n?<!--ANKI-NOTE-ID:\s*([0-9]+)\s*-->)?/gimu
const FIELD_RE = /^([A-Za-zÄÖÜäöüß0-9][A-Za-zÄÖÜäöüß0-9 /_-]{0,80}):[ \t]*(.*)$/gmu
const FILE_TAGS_RE = /^FILE TAGS:\s*(.*?)\s*$/imu
const TARGET_DECK_RE = /^TARGET DECK:\s*(.+?)\s*$/imu

export const CLOZE_OBSIDIAN_FIELDS = [
	'Text',
	'Back Extra',
	'Definitionen',
	'Mechanismus',
	'Klinik',
	'Dosis',
	'Cave',
	'Merksprüche',
	'Eigene Prüfungsfragen',
	'One by one',
]

export const DEFAULT_SYNKI_PARSER_OPTIONS: SynkiParserOptions = {
	defaultModelName: 'Cloze_obsidian',
	fieldAliases: {
		'back extra': 'Back Extra',
		clinic: 'Klinik',
		definition: 'Definitionen',
		definitionen: 'Definitionen',
		definitions: 'Definitionen',
		dose: 'Dosis',
		dosage: 'Dosis',
		dosis: 'Dosis',
		'eigene prüfungsfragen': 'Eigene Prüfungsfragen',
		'exam questions': 'Eigene Prüfungsfragen',
		klinik: 'Klinik',
		mechanism: 'Mechanismus',
		mechanismus: 'Mechanismus',
		mnemonics: 'Merksprüche',
		merksprüche: 'Merksprüche',
		'one by one': 'One by one',
		questions: 'Eigene Prüfungsfragen',
		text: 'Text',
	},
	fields: CLOZE_OBSIDIAN_FIELDS,
	modelAliases: {
		cloze: 'Cloze_obsidian',
	},
	textFieldName: 'Text',
}

export const FIELD_ALIASES: Record<string, string> = {
	'back extra': 'Back Extra',
	clinic: 'Klinik',
	definition: 'Definitionen',
	definitionen: 'Definitionen',
	definitions: 'Definitionen',
	dose: 'Dosis',
	dosage: 'Dosis',
	dosis: 'Dosis',
	'eigene prüfungsfragen': 'Eigene Prüfungsfragen',
	'exam questions': 'Eigene Prüfungsfragen',
	klinik: 'Klinik',
	mechanism: 'Mechanismus',
	mechanismus: 'Mechanismus',
	mnemonics: 'Merksprüche',
	merksprüche: 'Merksprüche',
	'one by one': 'One by one',
	questions: 'Eigene Prüfungsfragen',
	text: 'Text',
}

export function parseSynkiDocument(
	markdown: string,
	options: SynkiParserOptions = DEFAULT_SYNKI_PARSER_OPTIONS,
): ParsedSynkiDocument {
	const header = ANKI_HEADER_RE.exec(markdown)
	if (header === null) {
		return {
			ankiSection: '',
			cards: [],
			errors: ["Kein Abschnitt '## Anki' gefunden."],
			fileTags: [],
			targetDeck: null,
		}
	}

	const ankiSection = markdown.slice(header.index)
	const targetDeck = TARGET_DECK_RE.exec(ankiSection)?.[1]?.trim() ?? null
	const fileTags = splitTags(FILE_TAGS_RE.exec(ankiSection)?.[1] ?? '')
	const errors: string[] = []

	if (targetDeck === null) {
		errors.push("TARGET DECK fehlt im Abschnitt '## Anki'.")
	}

	const cards: ParsedSynkiCardBlock[] = []
	for (const match of ankiSection.matchAll(BLOCK_RE)) {
		const raw = match[0]
		const inner = match[1] ?? ''
		const noteId = match[2]?.trim() ?? null
		const startOffset = header.index + (match.index ?? 0)
		const endOffset = startOffset + raw.length
		const parsed = parseCardInner(inner, raw, noteId, startOffset, endOffset, options)
		cards.push(parsed.card)
		errors.push(...parsed.errors)
	}

	if (cards.length === 0) {
		errors.push('Keine START/END-Kartenblöcke gefunden.')
	}

	return {
		ankiSection,
		cards,
		errors,
		fileTags,
		targetDeck,
	}
}

export function splitTags(input: string): string[] {
	return [...new Set(input.split(/[,\s]+/u).map((tag) => tag.trim()).filter(Boolean))]
}

export function insertSyncedNoteIds(
	markdown: string,
	synced: { card: ParsedSynkiCardBlock; noteId: string }[],
): string {
	const sorted = [...synced].sort((a, b) => b.card.endOffset - a.card.endOffset)
	let updated = markdown

	for (const item of sorted) {
		if (item.card.noteId !== null) {
			continue
		}

		const insertion = `\n<!--ANKI-NOTE-ID: ${item.noteId}-->`
		const endLineOffset = item.card.raw.lastIndexOf('END')
		const insertionOffset =
			endLineOffset >= 0 ? item.card.startOffset + endLineOffset + 'END'.length : item.card.endOffset
		updated = updated.slice(0, insertionOffset) + insertion + updated.slice(insertionOffset)
	}

	return updated
}

function parseCardInner(
	inner: string,
	raw: string,
	noteId: null | string,
	startOffset: number,
	endOffset: number,
	options: SynkiParserOptions,
): { card: ParsedSynkiCardBlock; errors: string[] } {
	const normalized = inner.replaceAll('\r\n', '\n')
	const firstLineMatch = /^([^\n]+)\n?/u.exec(normalized)
	const modelName = normalizeModelName(firstLineMatch?.[1]?.trim() ?? '', options)
	const body = normalized.slice(firstLineMatch?.[0]?.length ?? 0)
	const errors: string[] = []

	if (modelName.length === 0) {
		errors.push('Ein START/END-Block hat keinen Notiztyp in der ersten Zeile.')
	}

	const fields = parseFields(body, options)
	for (const field of options.fields) {
		fields[field] ??= ''
	}

	const text = fields[options.textFieldName]?.trim() ?? ''
	if (text.length === 0) {
		errors.push(`Kartenblock '${modelName || 'unbekannt'}' hat kein Feld '${options.textFieldName}'.`)
	}

	const tags = splitTags(fields.Tags ?? '')
	delete fields.Tags

	return {
		card: {
			endOffset,
			fields,
			modelName,
			noteId,
			raw,
			startOffset,
			tags,
		},
		errors,
	}
}

function parseFields(body: string, options: SynkiParserOptions): Record<string, string> {
	const spans: FieldSpan[] = []
	for (const match of body.matchAll(FIELD_RE)) {
		const lineStart = match.index ?? 0
		const full = match[0]
		const name = normalizeFieldName((match[1] ?? '').trim(), options)
		if (name.length === 0) {
			continue
		}
		spans.push({
			lineStart,
			name,
			valueStart: lineStart + full.indexOf(':') + 1,
		})
	}

	const fields: Record<string, string> = {}
	for (const [index, span] of spans.entries()) {
		const next = spans[index + 1]
		const valueEnd = next === undefined ? body.length : next.lineStart
		fields[span.name] = body.slice(span.valueStart, valueEnd).replace(/^\s*/u, '').replace(/\s+$/u, '')
	}

	return fields
}

function normalizeFieldName(fieldName: string, options: SynkiParserOptions): string {
	const normalized = fieldName.toLowerCase().replaceAll(/\s+/gu, ' ').trim()
	return options.fieldAliases[normalized] ?? fieldName
}

function normalizeModelName(modelName: string, options: SynkiParserOptions): string {
	const normalized = modelName.toLowerCase().replaceAll(/\s+/gu, ' ').trim()
	return options.modelAliases[normalized] ?? modelName
}
