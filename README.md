# imkiruthika.in

Personal website for Kiruthika Ramesh, built with Astro and deployed to GitHub Pages.

## Local development

```sh
npm install
npm run dev
```

To create and preview a production build:

```sh
npm run build
npm run preview
```

## Content updates with Pages CMS

The homepage copy is stored in `src/data/home.json` and exposed in the Pages CMS configuration at `.pages.yml`. Once Pages CMS is connected to the GitHub repository, use its **Homepage** editor for routine copy updates. Links, SEO metadata, styles, and layout remain in code for now.

## SEO

- Canonical URL and social metadata are set in `src/pages/index.astro`.
- `src/pages/sitemap.xml.ts` generates the XML sitemap at build time.
- `public/robots.txt` references the sitemap.
- `public/favicon.svg` and `public/og-image.svg` provide the initial favicon and social preview artwork.

## GitHub Pages

The GitHub Actions workflow builds `dist` and deploys it to GitHub Pages. `public/CNAME` declares `imkiruthika.in`. In the repository settings, choose **GitHub Actions** as the Pages deployment source and confirm the domain's DNS records point to GitHub Pages. Avoid changing existing DNS/security settings unless GitHub Pages specifically requires it.

## Before launch

- Inspect dependency advisories after installing dependencies and generating a lockfile.
- Run `npm run build` and review the page locally on desktop and mobile.
- Verify the résumé, portfolio, email, LinkedIn, canonical URL, sitemap and robots.txt.
- Confirm the quote attribution before publication.
- Connect Pages CMS to the repository and test an edit-and-publish cycle.
- Configure Google Search Console after the site is live.
