import type { Entrypoint } from './types/config'

export type {
  Entrypoint,
  EntrypointButton,
  EntrypointButtonType,
} from './types/config'

export function defineEntrypoint(entrypoint: Entrypoint): Entrypoint {
  return entrypoint
}
