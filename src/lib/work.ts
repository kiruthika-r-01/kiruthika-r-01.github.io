/**
 * Selected Works: content lives in src/data/work.json (editable in Pages CMS). Small helpers shared by
 * the folders landing (/work/) and each folder's page (/work/<slug>/).
 */
import { existsSync } from 'node:fs';
import work from '../data/work.json';

export type WorkItem = { title: string; url?: string; company?: string; kind?: string; description?: string; image?: string; label?: string; url2?: string; label2?: string; format?: string; product?: string; rival?: string; market?: string };
export type WorkGroup = { title: string; layout: 'cards' | 'tiles' | 'matchups' | 'archive' | 'list' | 'by-company'; note?: string; filter?: boolean; items: WorkItem[] };
export type Folder = {
  slug: string; name: string; tab?: string; blurb?: string; peek?: string; kafka?: string;
  sealed?: boolean; sealedNote?: string; seoTitle?: string; seoDescription?: string; groups: WorkGroup[];
};
export type Company = { name: string; logo?: string; site?: string; about?: string; reader?: string; profile?: string; profileLabel?: string };

export const folders = work.folders as Folder[];
export const companies = work.companies as Company[];
export { work };

// How many things a folder holds: its archive if it has one, otherwise every item in it (projects and lists).
export const countOf = (f: Folder) => {
  const archive = f.groups.find((g) => g.layout === 'archive');
  if (archive) return archive.items.length;
  const urls = new Set<string>();
  f.groups.forEach((g) => g.items.forEach((i) => urls.add(i.url ?? i.title)));
  return urls.size;
};
export const countLabel = (f: Folder) => {
  if (f.sealed && countOf(f) === 0) return 'Soon';
  const n = countOf(f);
  return `${n} ${n === 1 ? 'piece' : 'pieces'}`;
};
// a folder's own page is "open" once it is unsealed or has something in it
export const isOpen = (f: Folder) => !f.sealed || countOf(f) > 0;
export const companyOf = (name?: string) => companies.find((c) => c.name === name);
// a 750px copy, when one sits next to the image (made for the images shipped with the page; CMS uploads simply use the original)
export const smallSrc = (src?: string) => {
  if (!src || !/\.webp$/.test(src)) return undefined;
  const s = src.replace(/\.webp$/, '-750.webp');
  return existsSync(new URL('../../public' + s, import.meta.url)) ? s : undefined;
};
export const isExternal = (url?: string) => !!url && /^https?:/.test(url);
