import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { execFileSync } from 'node:child_process';
import { sectionKeys, published, hrefOf } from '../lib/writings';
import { folders } from '../lib/work';

const site = 'https://imkiruthika.in';
const day = (d: Date) => d.toISOString().slice(0, 10);

// lastmod must be the date the page's content last changed. Google ignores lastmod on sites where it is not
// reliable, and the old build-date value moved every page on every deploy (Pages CMS commits included).
// Fixed pages: the last commit that touched their page or data files (needs full git history: deploy.yml
// checks out with fetch-depth 0). No history available: lastmod is left out rather than guessed.
const lastCommit = (...files: string[]) => {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...files], { encoding: 'utf8' }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : undefined;
  } catch { return undefined; }
};

export const GET: APIRoute = async () => {
  const pieces = published(await getCollection('writings'));
  const changed = (e: (typeof pieces)[number]) => day(e.data.updated ?? e.data.date);
  const newest = (list: typeof pieces) => list.map(changed).sort().at(-1);
  const urls: { path: string; lastmod?: string }[] = [
    { path: '/', lastmod: lastCommit('src/pages/index.astro', 'src/data/home.json') },
    { path: '/about/', lastmod: lastCommit('src/pages/about.astro', 'src/data/about.json', 'src/data/now.json') },
    { path: '/career/', lastmod: lastCommit('src/pages/career.astro', 'src/data/career.json') },
    { path: '/work/', lastmod: lastCommit('src/pages/work', 'src/data/work.json') },
    ...folders.map((f) => ({ path: `/work/${f.slug}/`, lastmod: lastCommit('src/pages/work', 'src/data/work.json') })),
    { path: '/shelf/', lastmod: lastCommit('src/pages/shelf.astro', 'src/data/shelf.json') },
    { path: '/kafka/', lastmod: lastCommit('src/pages/kafka.astro', 'src/data/kafka.json') },
    { path: '/writings/', lastmod: newest(pieces) },
    ...sectionKeys.map((k) => ({ path: `/writings/${k}/`, lastmod: newest(pieces.filter((e) => e.data.section === k)) })),
    ...pieces.map((e) => ({ path: hrefOf(e), lastmod: changed(e) })),
  ];
  const body = urls.map((u) => `  <url><loc>${site}${u.path}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
