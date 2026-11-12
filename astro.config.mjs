import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://imkiruthika.in',
  // put the CSS inside each page: no extra render-blocking request before the first paint
  build: { inlineStylesheets: 'always' },
});
