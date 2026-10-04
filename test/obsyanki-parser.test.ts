import { describe, expect, test } from 'vitest'
import { insertSyncedNoteIds, parseObsyankiDocument, splitTags } from '../src/obsyanki-parser'

const sample = `# Cushing-Syndrom

Lerntext.

## Anki

TARGET DECK: Medicine::Diagnoses::Example
FILE TAGS: medicine example

START
Cloze_obsidian
Text: Beim zentralen Cushing kann hochdosiertes Dexamethason das Serumcortisol um mindestens {{c1::50 %::Grenzwert}} supprimieren.
Back Extra: Diese partielle Suppressibilität ist diagnostisch hilfreich.
Definitionen:
Mechanismus:
Klinik:
Dosis: zweimal 8 mg Dexamethason nachts.
Cave:
Merksprüche: Zentral lässt sich noch bremsen.
Eigene Prüfungsfragen: Wie verhält sich der Test bei ektoper ACTH-Produktion?
One by one:
Tags: medicine example diagnosis
END
`

describe('obsyanki parser', () => {
	test('splits tags from spaces and commas', () => {
		expect(splitTags('a b, c a')).toEqual(['a', 'b', 'c'])
	})

	test('parses the embedded Obsyanki block format', () => {
		const parsed = parseObsyankiDocument(sample)

		expect(parsed.errors).toEqual([])
		expect(parsed.targetDeck).toBe('Medicine::Diagnoses::Example')
		expect(parsed.fileTags).toEqual(['medicine', 'example'])
		expect(parsed.cards).toHaveLength(1)
		expect(parsed.cards[0]?.modelName).toBe('Cloze_obsidian')
		expect(parsed.cards[0]?.fields.Text).toContain('{{c1::50 %::Grenzwert}}')
		expect(parsed.cards[0]?.fields['Back Extra']).toContain('partielle')
		expect(parsed.cards[0]?.fields.Dosis).toBe('zweimal 8 mg Dexamethason nachts.')
		expect(parsed.cards[0]?.tags).toEqual(['medicine', 'example', 'diagnosis'])
	})

	test('reads and writes stable Anki note ids', () => {
		const withExistingId = parseObsyankiDocument(`${sample}<!--ANKI-NOTE-ID: 1741234567890-->`)
		expect(withExistingId.cards[0]?.noteId).toBe('1741234567890')

		const parsed = parseObsyankiDocument(sample)
		const card = parsed.cards[0]
		expect(card).toBeDefined()

		const updated = insertSyncedNoteIds(sample, [{ card: card!, noteId: '1741234567890' }])
		expect(updated).toContain('END\n<!--ANKI-NOTE-ID: 1741234567890-->')
	})

	test('normalizes common Cloze_obsidian model and field aliases', () => {
		const parsed = parseObsyankiDocument(`## Anki
TARGET DECK: Medicine::Diagnoses::Example

START
Cloze
Text: {{c1::answer::hint}}
Definitions: English field label
Mechanism: English mechanism
Dose: English dose
END
`)

		expect(parsed.errors).toEqual([])
		expect(parsed.cards[0]?.modelName).toBe('Cloze_obsidian')
		expect(parsed.cards[0]?.fields.Definitionen).toBe('English field label')
		expect(parsed.cards[0]?.fields.Mechanismus).toBe('English mechanism')
		expect(parsed.cards[0]?.fields.Dosis).toBe('English dose')
	})
})
