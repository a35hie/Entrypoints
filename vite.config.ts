import { cp } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

function copyBundledTemplate(): Plugin {
  return {
    name: 'copy-bundled-entrypoints-template',
    async closeBundle() {
      await cp(
        resolve(projectRoot, 'src/entrypoints-template'),
        resolve(projectRoot, 'dist/entrypoints-template'),
        { recursive: true, force: true }
      )
    },
  }
}

export default defineConfig({
  plugins: [copyBundledTemplate()],
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
