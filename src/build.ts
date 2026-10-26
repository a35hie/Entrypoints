import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'sass'
import { build, type Plugin } from 'vite'
import { minify } from 'html-minifier-terser'
import type { Entrypoint, EntrypointButton } from './types/config'

const TEMPLATE_DIRECTORY = join('src', 'entrypoints-template')
const BUNDLED_TEMPLATE_DIRECTORY = 'entrypoints-template'
const TEMPLATE_FILE = join(TEMPLATE_DIRECTORY, 'index.html')
const SASS_FILE = join(TEMPLATE_DIRECTORY, 'main.sass')

type BuildOptions = {
  root: string
  config: Entrypoint
}

const iconCache = new Map<string, Promise<string>>()

export async function createEntrypoint({
  root,
  config,
}: BuildOptions): Promise<void> {
  const { templatePath, sassPath } = resolveTemplatePaths(root)

  const outputDirectory = resolve(root, config.dir)
  await copyRelativeFavicon(root, outputDirectory, config.favicon)

  await build({
    // Treat the template directory as Vite's root so the single HTML entry is emitted
    // directly as <config.dir>/index.html instead of preserving the template directory in output.
    root: dirname(templatePath),
    configFile: false,
    plugins: [
      entrypointTemplatePlugin({ config, templatePath, sassPath }),
      minifyEntrypointPlugin(),
    ],
    build: {
      outDir: outputDirectory,
      emptyOutDir: false,
      minify: false,
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      rollupOptions: {
        input: templatePath,
      },
    },
  })
}

async function copyRelativeFavicon(
  root: string,
  outputDirectory: string,
  favicon: string
): Promise<void> {
  if (isExternalReference(favicon) || isAbsolute(favicon)) return

  const source = resolve(root, favicon)
  const outputPath = relative(root, source)
  const destination = resolve(outputDirectory, outputPath)
  const destinationRelativeToOutput = relative(outputDirectory, destination)

  if (
    destinationRelativeToOutput === '..' ||
    destinationRelativeToOutput.startsWith('..')
  ) {
    throw new Error(
      `The favicon path "${favicon}" must resolve inside the project root.`
    )
  }

  if (source === destination) return

  await mkdir(dirname(destination), { recursive: true })
  await copyFile(source, destination)
}

function isExternalReference(value: string): boolean {
  return /^(?:data:|https?:|\/\/)/i.test(value)
}

function resolveTemplatePaths(root: string): {
  templatePath: string
  sassPath: string
} {
  const templateDirectories = [
    resolve(root, TEMPLATE_DIRECTORY),
    // Prefer the copied template in dist for the published package.
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      BUNDLED_TEMPLATE_DIRECTORY
    ),
    // This supports running the source CLI directly from the repository.
    resolve(dirname(fileURLToPath(import.meta.url)), '..', TEMPLATE_DIRECTORY),
  ]

  for (const templateDirectory of templateDirectories) {
    const templatePath = join(templateDirectory, 'index.html')
    const sassPath = join(templateDirectory, 'main.sass')

    if (existsSync(templatePath) && existsSync(sassPath)) {
      return { templatePath, sassPath }
    }
  }

  throw new Error(
    `Could not find src/entrypoints-template/index.html and src/entrypoints-template/main.sass in the project or the Entrypoints library.`
  )
}

function entrypointTemplatePlugin({
  config,
  templatePath,
  sassPath,
}: {
  config: Entrypoint
  templatePath: string
  sassPath: string
}): Plugin {
  return {
    name: 'entrypoints-template',
    enforce: 'pre',

    async transformIndexHtml(html, ctx) {
      if (resolve(ctx.filename) !== templatePath) return html

      const compiledCss = compile(sassPath, {
        style: 'compressed',
        loadPaths: [dirname(sassPath)],
      }).css
      const css = await inlineCssAssets(compiledCss, dirname(sassPath))
      const renderedButtons = await renderButtons(config.buttons)
      const renderedHtml = renderTemplate(html, config, renderedButtons)
      const htmlWithStyles = inlineStylesheet(renderedHtml, css)

      return htmlWithStyles
    },
  }
}

function minifyEntrypointPlugin(): Plugin {
  return {
    name: 'entrypoints-minify',
    enforce: 'post',

    async generateBundle(_outputOptions, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'asset' || !output.fileName.endsWith('.html'))
          continue

        output.source = await minify(String(output.source), {
          collapseWhitespace: true,
          minifyCSS: true,
          minifyJS: true,
          removeComments: true,
          removeEmptyAttributes: true,
          removeOptionalTags: false,
        })
      }
    },
  }
}

function renderTemplate(
  template: string,
  config: Entrypoint,
  renderedButtons: string
): string {
  const withButtons = template.replace(
    /{{\s*config\.buttons\s*}}/g,
    renderedButtons
  )

  return withButtons.replace(
    /{{\s*config\.([\w]+)\s*}}/g,
    (match, key: string) => {
      if (key === 'buttons') return renderedButtons
      if (!(key in config)) return match

      const value = config[key as keyof Entrypoint]
      if (typeof value !== 'string') return match
      return escapeHtml(value)
    }
  )
}

async function renderButtons(buttons: EntrypointButton[]): Promise<string> {
  const rendered = await Promise.all(
    buttons.map(async button => {
      const icon = await fetchIcon(button.icon)

      return [
        `<a class="button-link" href="${escapeAttribute(button.href)}" target="_blank" rel="noopener noreferrer">`,
        `<button class="button ${escapeAttribute(button.type)}" type="button">`,
        `<span class="button-icon">${icon}</span>`,
        `<span>${escapeHtml(button.title)}</span>`,
        '</button>',
        '</a>',
      ].join('')
    })
  )

  return rendered.join('')
}

async function fetchIcon(iconName: string): Promise<string> {
  const cached = iconCache.get(iconName)
  if (cached) return cached

  const request = downloadIcon(iconName)
  iconCache.set(iconName, request)
  return request
}

async function downloadIcon(iconName: string): Promise<string> {
  const separator = iconName.indexOf(':')
  if (separator < 1 || separator === iconName.length - 1) {
    throw new Error(
      `Invalid Iconify icon "${iconName}". Use the "prefix:name" format, for example "solar:book-line-duotone".`
    )
  }

  const prefix = iconName.slice(0, separator)
  const name = iconName.slice(separator + 1)
  const iconUrl = `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`
  const response = await fetch(iconUrl)

  if (!response.ok) {
    throw new Error(
      `Iconify could not download "${iconName}" (${response.status} ${response.statusText}).`
    )
  }

  const svg = await response.text()
  if (!/^\s*<svg[\s>]/i.test(svg)) {
    throw new Error(`Iconify returned an invalid SVG for "${iconName}".`)
  }

  return svg
    .replace(/<\?xml[^>]*>/gi, '')
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<svg\b/i, '<svg aria-hidden="true" focusable="false"')
}

function inlineStylesheet(html: string, css: string): string {
  const stylesheet = `<style>${css}</style>`
  const withoutSassLinks = html.replace(
    /<link\b[^>]*href=["'][^"']*main\.sass["'][^>]*>\s*/gi,
    ''
  )

  if (/<\/head>/i.test(withoutSassLinks)) {
    return withoutSassLinks.replace(/<\/head>/i, `${stylesheet}</head>`)
  }

  return `${stylesheet}${withoutSassLinks}`
}

async function inlineCssAssets(
  css: string,
  baseDirectory: string
): Promise<string> {
  const assets = new Map<string, string>()
  const references = [...css.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)]

  await Promise.all(
    references.map(async ([, quote, reference]) => {
      if (!reference || /^(?:data:|https?:|#|\/\/)/i.test(reference)) return

      const [assetReference, suffix = ''] = reference.split(/([?#].*)/, 2)
      if (!assetReference) return

      try {
        const contents = await readFile(resolve(baseDirectory, assetReference))
        const mimeType = getMimeType(assetReference)
        assets.set(
          reference,
          `data:${mimeType};base64,${contents.toString('base64')}${suffix}`
        )
      } catch {
        // Leave unresolved URLs alone so Sass can still reference external resources.
      }
    })
  )

  return css.replace(
    /url\(\s*(["']?)([^"')]+)\1\s*\)/gi,
    (match, _quote, reference) => {
      const replacement = assets.get(reference)
      return replacement ? `url("${replacement}")` : match
    }
  )
}

function getMimeType(path: string): string {
  const extension = path.toLowerCase().split('.').pop()
  const mimeTypes: Record<string, string> = {
    css: 'text/css',
    gif: 'image/gif',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    svg: 'image/svg+xml',
    ttf: 'font/ttf',
    woff: 'font/woff',
    woff2: 'font/woff2',
  }
  return mimeTypes[extension ?? ''] ?? 'application/octet-stream'
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character] ?? character
  })
}

function escapeAttribute(value: string): string {
  return escapeHtml(value)
}

async function assertFile(path: string, label: string): Promise<void> {
  try {
    await readFile(path)
  } catch {
    throw new Error(`Could not find the ${label} at ${path}.`)
  }
}

export function getTemplatePaths(root: string): {
  templatePath: string
  sassPath: string
} {
  return resolveTemplatePaths(root)
}
