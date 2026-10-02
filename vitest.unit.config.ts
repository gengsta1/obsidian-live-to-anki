import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		exclude: ['test/**/*.e2e.test.ts'],
		include: ['test/**/*.test.ts'],
	},
})
