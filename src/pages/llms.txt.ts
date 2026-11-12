import type { APIRoute } from 'astro';
import home from '../data/home.json';
import career from '../data/career.json';
import now from '../data/now.json';

/**
 * /llms.txt: a plain-text map of the site for large language models (llmstxt.org format).
 * Built from the same JSON the pages use, so it never drifts from the site.
 */
const site = 'https://imkiruthika.in';
const portfolioUrl = 'https://ripe-stoat-21e.notion.site/Kiruthika-Ramesh-Portfolio-b938168891d8823892b08165cdc90adf?pvs=74';
const intro = home.intro.split('\n\n')[0].trim();

export const GET: APIRoute = () => {
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
    `- [Résumé (PDF)](${site}/resume.pdf): Her current résumé.`,
    `- [Selected works](${portfolioUrl}): Portfolio of selected projects (Notion).`,
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
