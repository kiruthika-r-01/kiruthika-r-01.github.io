import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { sectionKeys, sections, allTopics } from './lib/writings';

// One Markdown file per piece in src/content/writings (edited in Pages CMS). The file name is the URL slug.
const writings = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/writings' }),
  schema: z.object({
    title: z.string(),
    dek: z.string().optional(),             // optional one-line summary, shown in lists and used for SEO
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    section: z.enum(sectionKeys),
    topic: z.enum(allTopics as [string, ...string[]]),
    draft: z.boolean().default(false),
    cover: z.string().optional(),           // e.g. /images/writings/covers/the-cat.webp (also used for the share image)
    coverAlt: z.string().optional(),
    coverWidth: z.number().optional(),      // the image's real width in pixels, so it is never shown larger than it is
    og: z.string().optional(),
    seoTitle: z.string().optional(),        // the full title shown in search results (defaults to the title)
    seoDescription: z.string().optional(),  // the search snippet (defaults to the one-line summary or the opening)              // e.g. /og/writings-the-cat.jpg (1200 x 630)
  }).refine((d) => sections[d.section].topics.includes(d.topic), { message: 'This topic does not belong to the chosen section', path: ['topic'] }),
});

export const collections = { writings };
