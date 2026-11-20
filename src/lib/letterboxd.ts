/**
 * Letterboxd, read at build time from the public diary feed (letterboxd.com/<user>/rss/).
 * Gives the most recent watches: title, year, her rating, watched date, poster and link. Favourite four are not in
 * the feed, so those are set in Pages CMS (src/data/shelf.json). Any failure (offline build, feed down) returns an
 * empty list, so the page simply leaves the strip out instead of breaking the build.
 * A daily scheduled rebuild keeps it fresh (see .github/workflows/deploy.yml).
 */
export type Watch = { title: string; year: string; rating?: number; liked: boolean; date: string; link: string; poster?: string };

const decode = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&#0?39;/g, '’').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const tag = (item: string, name: string) => { const m = item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]) : ''; };

let cache: Promise<Watch[]> | null = null;
export const recentWatches = (user: string, limit = 8): Promise<Watch[]> => {
  cache ??= (async () => {
    try {
      const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`https://letterboxd.com/${user}/rss/`, { signal: ctrl.signal, headers: { 'User-Agent': 'imkiruthika.in site build' } });
      clearTimeout(timer);
      if (!res.ok) return [];
      const xml = await res.text();
      return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
        const film = tag(it, 'letterboxd:filmTitle'); if (!film) return null;   // lists and other items have no film
        const poster = it.match(/<img src="([^"]+)"/)?.[1]?.replace(/-0-\d+-0-\d+-crop/, '-0-300-0-450-crop');
        const r = tag(it, 'letterboxd:memberRating');
        return { title: film, year: tag(it, 'letterboxd:filmYear'), rating: r ? Number(r) : undefined, liked: tag(it, 'letterboxd:memberLike') === 'Yes', date: tag(it, 'letterboxd:watchedDate'), link: tag(it, 'link'), poster } as Watch;
      }).filter((w): w is Watch => !!w);
    } catch { return []; }
  })();
  return cache.then((list) => list.slice(0, limit));
};
export const stars = (r?: number) => (r ? '★'.repeat(Math.floor(r)) + (r % 1 ? '½' : '') : '');
