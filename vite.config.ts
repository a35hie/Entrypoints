import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(projectRoot, 'index.ts'),
        cli: resolve(projectRoot, 'src/cli.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        'node:fs',
        'node:fs/promises',
        'node:path',
        'node:url',
        'html-minifier-terser',
        'sass',
        'vite',
      ],
    },
  },
})
