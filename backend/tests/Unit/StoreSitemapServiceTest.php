<?php

namespace Tests\Unit;

use App\Services\StorefrontSessionService;
use App\Services\StoreSitemapService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class StoreSitemapServiceTest extends TestCase
{
    public function test_discovers_bigcommerce_products_from_xmlsitemap_php(): void
    {
        $indexXml = <<<'XML'
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.maxximastyle.com/xmlsitemap.php?type=pages&amp;page=1</loc>
  </sitemap>
  <sitemap>
    <loc>https://www.maxximastyle.com/xmlsitemap.php?type=products&amp;page=1</loc>
  </sitemap>
</sitemapindex>
XML;

        $productXml = <<<'XML'
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.maxximastyle.com/led-wall-light-msl-123/</loc>
  </url>
  <url>
    <loc>https://www.maxximastyle.com/cart.php</loc>
  </url>
</urlset>
XML;

        Http::fake([
            'https://www.maxximastyle.com/sitemap.xml' => Http::response('', 404),
            'https://www.maxximastyle.com/sitemap_index.xml' => Http::response('', 404),
            'https://www.maxximastyle.com/sitemap-index.xml' => Http::response('', 404),
            'https://www.maxximastyle.com/wp-sitemap.xml' => Http::response('', 404),
            'https://www.maxximastyle.com/sitemap/sitemap.xml' => Http::response('', 404),
            'https://www.maxximastyle.com/xmlsitemap.php' => Http::response($indexXml, 200),
            'https://www.maxximastyle.com/xmlsitemap.php?type=pages&page=1' => Http::response('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.maxximastyle.com/about-us/</loc></url></urlset>', 200),
            'https://www.maxximastyle.com/xmlsitemap.php?type=products&page=1' => Http::response($productXml, 200),
            'https://www.maxximastyle.com' => Http::response('<html><body>Maxxima</body></html>', 200),
            'https://www.maxximastyle.com/robots.txt' => Http::response("User-agent: *\nDisallow: /cart.php\n", 200),
        ]);

        $service = new StoreSitemapService(new StorefrontSessionService);

        $urls = $service->discoverProductUrls('https://www.maxximastyle.com', 10);

        $this->assertSame([
            'https://www.maxximastyle.com/led-wall-light-msl-123/',
        ], $urls);
    }
}
