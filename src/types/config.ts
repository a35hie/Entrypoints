export type EntrypointButtonType = 'standard' | 'transparent' | 'prominent'

export interface EntrypointButton {
  type: EntrypointButtonType
  title: string
  icon: string
  href: string
}

export interface Entrypoint {
  dir: string
  title: string
  description: string
  favicon: string
  buttons: EntrypointButton[]
}
