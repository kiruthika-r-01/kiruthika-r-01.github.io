import type { APIRoute } from 'astro';

const site = 'https://imkiruthika.in';
// pages that should be indexed; lastmod is the build date (every deploy rebuilds the whole site)
const pages = [
  { path: '/', priority: '1.0' },
  { path: '/about/', priority: '0.8' },
  { path: '/career/', priority: '0.8' },
];

export const GET: APIRoute = () => {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = pages.map((p) => `  <url><loc>${site}${p.path}</loc><lastmod>${lastmod}</lastmod><priority>${p.priority}</priority></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
