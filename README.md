# Entrypoints
This repo is for generating basic entrypoint pages for my web-related projects which aren't websites.

## How To Use
1. Add the package: `bun add -d entrypoints`
2. Add your config at `entrypoints.config.ts`:
   ```ts
   import { defineEntrypoint } from 'entrypoints'
   
   export default defineEntrypoint({
     dir: 'dist',
     title: 'ash\'s Fonts',
     description: 'My hosted webfont collection.',
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
3. Add to your build script: `"build": "... && entrypoints create`
