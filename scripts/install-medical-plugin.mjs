import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const vaultPath = process.argv[2]
if (vaultPath === undefined) {
	console.error('Usage: node scripts/install-medical-plugin.mjs <vault-path>')
	process.exit(1)
}

const pluginDir = join(vaultPath, '.obsidian', 'plugins', 'obsidian-live-to-anki')
mkdirSync(pluginDir, { recursive: true })

for (const file of readdirSync('dist')) {
	const source = join('dist', file)
	if (statSync(source).isFile()) {
		copyFileSync(source, join(pluginDir, file))
	}
}

console.log(`Installed Obsidian Live to Anki to ${pluginDir}`)
