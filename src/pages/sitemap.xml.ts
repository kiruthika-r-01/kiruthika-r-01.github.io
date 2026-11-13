import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { sectionKeys, published, hrefOf } from '../lib/writings';

const site = 'https://imkiruthika.in';

// Pages that should be indexed. Fixed pages use the build date as lastmod (every deploy rebuilds the site);
// each piece of writing uses its own published / updated date.
export const GET: APIRoute = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const pieces = published(await getCollection('writings'));
  const urls = [
    { path: '/', lastmod: today, priority: '1.0' },
    { path: '/about/', lastmod: today, priority: '0.8' },
    { path: '/career/', lastmod: today, priority: '0.8' },
    { path: '/writings/', lastmod: today, priority: '0.9' },
    { path: '/kafka/', lastmod: today, priority: '0.3' },
    ...sectionKeys.map((k) => ({ path: `/writings/${k}/`, lastmod: today, priority: '0.7' })),
    ...pieces.map((e) => ({ path: hrefOf(e), lastmod: (e.data.updated ?? e.data.date).toISOString().slice(0, 10), priority: '0.8' })),
  ];
  const body = urls.map((u) => `  <url><loc>${site}${u.path}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
