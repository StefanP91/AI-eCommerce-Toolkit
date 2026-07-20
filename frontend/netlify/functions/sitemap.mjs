const SITE = 'https://ai-ecommerce-suite.netlify.app';

const PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/pricing', changefreq: 'weekly', priority: '0.95' },
  { path: '/register', changefreq: 'monthly', priority: '0.9' },
  { path: '/login', changefreq: 'monthly', priority: '0.5' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
];

function buildSitemapXml() {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = PAGES.map((page) => `  <url>
    <loc>${SITE}${page.path === '/' ? '/' : page.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export async function handler() {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
    body: buildSitemapXml(),
  };
}
