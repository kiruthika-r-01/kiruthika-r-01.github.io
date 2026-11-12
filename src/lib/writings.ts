/**
 * Writings: the two sections, their fixed topic lists, their card photos, and small helpers.
 * Topics are a closed list on purpose (one main topic per piece) so the index never sprawls.
 */
export const sectionKeys = ['personal', 'work'] as const;
export type SectionKey = (typeof sectionKeys)[number];

/** The closing quote above the footer: one for the Writings landing, one per section (shared by its pieces). Approved November 2026. */
export const writingsQuote = { text: 'I write entirely to find out what I\'m thinking.', by: 'Joan Didion' };

export const sections: Record<SectionKey, {
  name: string; desc: string; topics: readonly string[]; quote: { text: string; by: string };
  seo: { title: string; description: string };
  photo: { small: string; large: string; alt: string; credit: string; focus: string };
}> = {
  personal: {
    name: 'Personal',
    desc: 'Life, observations, books, films and series.',
    seo: { title: 'Personal Writing | Kiruthika Ramesh', description: 'Personal essays by Kiruthika Ramesh on life, observations, books, films and series, and the things worth caring about.' },
    quote: { text: 'We are here on Earth to fart around, and don\'t let anybody tell you different.', by: 'Kurt Vonnegut' },
    topics: ['Life', 'Observations', 'Books', 'Films and series'],
    photo: {
      small: '/images/writings/personal-900.webp', large: '/images/writings/personal-1600.webp',
      alt: 'Evening light falling on a bookshelf at the end of a dark hallway',
      credit: 'Shane Monarc on Unsplash', focus: '50% 40%',
    },
  },
  work: {
    name: 'Work',
    desc: 'Marketing, B2B, GTM, product marketing, AI and experiments.',
    seo: { title: 'Work Writing: Marketing, GTM and AI | Kiruthika Ramesh', description: 'Kiruthika Ramesh on marketing, B2B, GTM, product marketing, AI, experiments and what her career has taught her.' },
    quote: { text: 'How we spend our days is, of course, how we spend our lives.', by: 'Annie Dillard' },
    topics: ['SEO and AEO', 'Content', 'GTM', 'Product marketing', 'AI and tools', 'Experiments', 'Career'],
    photo: {
      small: '/images/writings/work-900.webp', large: '/images/writings/work-1600.webp',
      alt: 'Sunset light across a wall above a laptop on a dresser',
      credit: 'Kate Tepla on Unsplash', focus: '50% 62%',
    },
  },
};
export const allTopics = [...sections.personal.topics, ...sections.work.topics];

export const srcset = (k: SectionKey) => `${sections[k].photo.small} 900w, ${sections[k].photo.large} 1600w`;

type Entry = { id: string; body?: string; data: { section: SectionKey; date: Date; draft?: boolean } };
export const slugOf = (e: { id: string }) => e.id.replace(/\.mdx?$/, '');
export const hrefOf = (e: Entry) => `/writings/${e.data.section}/${slugOf(e)}/`;
export const newestFirst = <T extends Entry>(list: T[]) => [...list].sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
export const published = <T extends Entry>(list: T[]) => list.filter((e) => !e.data.draft);
export const minutesOf = (e: Entry) => Math.max(1, Math.round((e.body ?? '').split(/\s+/).filter(Boolean).length / 230));
export const shortDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
export const longDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
/** A plain-text summary from the opening of a piece, for meta descriptions when there is no one-line summary. */
export const excerpt = (body = '', max = 155) => {
  const text = body.replace(/[#>*_`\[\]]/g, '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,.;:]$/, '') + '…';
};
