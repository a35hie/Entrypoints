# Entrypoints
This repo is for generating basic entrypoint pages for my web-related projects which aren't websites.

## How To Use
1. Add the package: `bun add -d @a35hie/entrypoints`
2. Add your config at `entrypoints.config.ts`:
   ```ts
   import { defineEntrypoint } from '@a35hie/entrypoints'
   
   export default defineEntrypoint({
     dir: 'dist',
     title: 'ash\'s Fonts',
     description: 'My hosted webfont collection.',
     favicon: 'favicon.svg',
     buttons: [
       { 
         type: 'prominent', 
         title: 'Learn More', 
         icon: 'solar:book-line-duotone',
         href: 'https://guides.a35hie.me/'
       }
     ]
   })
   ```
3. Optionally add a project-specific template at `src/entrypoints-template/index.html` and a stylesheet at `src/entrypoints-template/main.sass`. If they are omitted, the library's bundled template is used.

   The HTML file can use `{{ config.title }}`, `{{ config.description }}`, and `{{ config.buttons }}`. Button markup is generated with the configured link, type, title, and an inline SVG downloaded from Iconify at build time. The Sass file is compiled and minified, and local Sass assets are inlined.

4. Add to your build script: `"build": "... && entrypoints create"`

`entrypoints create` uses Vite to emit `<config.dir>/index.html`. The result is one minified, self-contained HTML file with the compiled stylesheet and button icons inlined. Use `--config` if the config file has another name:

```sh
entrypoints create --config config/entrypoints.ts
```

The built-in template in `src/entrypoints-template` is also a small starting point for a project-specific template. Its button classes are `button standard`, `button transparent`, and `button prominent`.

Relative favicon paths are resolved from the project root and copied into the configured output directory, preserving their relative path. Absolute URLs, root URLs, and data URLs are left unchanged.
