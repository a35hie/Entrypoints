#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadConfigFromFile } from 'vite'
import { createEntrypoint } from './build'
import type { Entrypoint } from './types/config'

const DEFAULT_CONFIG_FILE = 'entrypoints.config.ts'

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)

  if (command !== 'create') {
    printHelp()
    if (command) process.exitCode = 1
    return
  }

  const root = process.cwd()
  const configFile = getConfigFile(args)
  const config = await loadEntrypointConfig(root, configFile)

  validateConfig(config, configFile)
  await createEntrypoint({ root, config })
  console.log(
    `Entrypoint created at ${resolve(root, config.dir, 'index.html')}`
  )
}

async function loadEntrypointConfig(
  root: string,
  configFile: string
): Promise<Entrypoint> {
  const configPath = resolve(root, configFile)
  if (!existsSync(configPath)) {
    throw new Error(`Could not find the Entrypoints config at ${configPath}.`)
  }

  const loaded = await loadConfigFromFile(
    { command: 'build', mode: 'production' },
    configPath,
    root
  )

  if (!loaded)
    throw new Error(`Could not load the Entrypoints config at ${configPath}.`)
  return loaded.config as Entrypoint
}

function validateConfig(
  config: Entrypoint,
  configFile: string
): asserts config is Entrypoint {
  if (!config || typeof config !== 'object') {
    throw new Error(
      `${configFile} must export a config object as its default export.`
    )
  }

  const requiredStrings = ['dir', 'title', 'description'] as const
  for (const key of requiredStrings) {
    if (typeof config[key] !== 'string' || config[key].length === 0) {
      throw new Error(`${configFile} requires a non-empty string for "${key}".`)
    }
  }

  if (!Array.isArray(config.buttons)) {
    throw new Error(`${configFile} requires a "buttons" array.`)
  }

  for (const [index, button] of config.buttons.entries()) {
    if (!button || typeof button !== 'object') {
      throw new Error(`${configFile} has an invalid button at index ${index}.`)
    }

    for (const key of ['type', 'title', 'icon', 'href'] as const) {
      if (typeof button[key] !== 'string' || button[key].length === 0) {
        throw new Error(
          `${configFile} requires a non-empty string for buttons[${index}].${key}.`
        )
      }
    }
  }
}

function getConfigFile(args: string[]): string {
  const configIndex = args.indexOf('--config')
  if (configIndex === -1) return DEFAULT_CONFIG_FILE

  const configFile = args[configIndex + 1]
  if (!configFile) throw new Error('The --config option requires a file path.')
  return configFile
}

function printHelp(): void {
  console.log(`Usage: entrypoints create [--config <file>]`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`entrypoints: ${message}`)
  process.exitCode = 1
})
