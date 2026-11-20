import type { APIRoute } from 'astro';
import home from '../data/home.json';
import career from '../data/career.json';
import now from '../data/now.json';
import { getCollection } from 'astro:content';
import { sections, published, newestFirst, hrefOf, excerpt } from '../lib/writings';
import { folders, countOf } from '../lib/work';

/**
 * /llms.txt: a plain-text map of the site for large language models (llmstxt.org format).
 * Built from the same JSON the pages use, so it never drifts from the site.
 */
const site = 'https://imkiruthika.in';
const intro = home.intro.split('\n\n')[0].trim();

export const GET: APIRoute = async () => {
  const pieces = newestFirst(published(await getCollection('writings')));
  const lines = [
    '# Kiruthika Ramesh',
    '',
    '> Marketing generalist based in Chennai, India, working across content, SEO, AEO, go-to-market, sales enablement and design, and exploring what AI and code can do for marketing.',
    '',
    intro,
    '',
    '## Pages',
    '',
    `- [Home](${site}/): Introduction and testimonials from people she has worked with.`,
    `- [About](${site}/about/): Her story in four chapters: growing up curious, moving from content writing into the wider marketing discipline, how she sees marketing, and what she is exploring now.`,
    `- [Career](${site}/career/): Career timeline with roles, results, tools and competencies.`,
    `- [Writings](${site}/writings/): Her essays and notes, in two sections: Personal (life, observations, books, films and series) and Work (marketing, B2B, GTM, product marketing, AI and experiments).`,
    `- [Résumé (PDF)](${site}/resume.pdf): Her current résumé.`,
    `- [Selected works](${site}/work/): Her portfolio, filed by kind of work.`,
    `- [Shelf](${site}/shelf/): What she is watching, reading and listening to, her favourite four of everything, the people and brands she learns from, and the desk she works at.`,
    '',
    '## Selected works',
    '',
    ...folders.map((f) => `- [${f.name}](${site}/work/${f.slug}/): ${f.blurb ?? ''}${countOf(f) ? ` (${countOf(f)} pieces)` : ' (coming soon)'}`),
    '',
    '## Writings',
    '',
    ...pieces.map((e) => `- [${e.data.title}](${site}${hrefOf(e)}): ${sections[e.data.section].name}, ${e.data.topic}. ${e.data.dek ?? excerpt(e.body, 160)}`),
    `- [RSS feed](${site}/writings/rss.xml)`,
    '',
    `## Now (${now.updated})`,
    '',
    now.text,
    '',
    '## Experience',
    '',
    ...career.experiences.flatMap((e) => [
      `### ${e.company}: ${e.role} (${e.dates})`,
      '',
      ...e.highlights.map((h) => `- ${h.text}`),
      '',
    ]),
    '## Competencies',
    '',
    career.competencies.join(', '),
    '',
    '## Tools',
    '',
    career.tools.map((t) => t.name).join(', '),
    '',
    '## Contact',
    '',
    '- Email: kiruthikar0123@gmail.com',
    '- [LinkedIn](https://www.linkedin.com/in/kiruthika-ramesh/)',
    '- [GitHub](https://github.com/kiruthika-r-01)',
    '',
    '## Optional',
    '',
    '- [Letterboxd](https://letterboxd.com/kirthika_/): Films she has watched and logged.',
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
