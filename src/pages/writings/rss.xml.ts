import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { sections, published, newestFirst, hrefOf, excerpt } from '../../lib/writings';

// /writings/rss.xml: a plain RSS 2.0 feed of every published piece (no dependency needed)
const site = 'https://imkiruthika.in';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async () => {
  const items = newestFirst(published(await getCollection('writings')));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Writings by Kiruthika Ramesh</title>
    <link>${site}/writings/</link>
    <description>Essays and notes by Kiruthika Ramesh, on life and on work.</description>
    <language>en</language>
    <atom:link href="${site}/writings/rss.xml" rel="self" type="application/rss+xml" />
${items.map((e) => `    <item>
      <title>${esc(e.data.title)}</title>
      <link>${site}${hrefOf(e)}</link>
      <guid isPermaLink="true">${site}${hrefOf(e)}</guid>
      <pubDate>${e.data.date.toUTCString()}</pubDate>
      <category>${esc(sections[e.data.section].name)}</category>
      <category>${esc(e.data.topic)}</category>
      <description>${esc(e.data.dek ?? excerpt(e.body, 280))}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
