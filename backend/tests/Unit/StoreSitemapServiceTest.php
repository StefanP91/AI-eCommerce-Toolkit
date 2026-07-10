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
        $this->fakeStoreResponses('https://www.maxximastyle.com', [
            'https://www.maxximastyle.com/xmlsitemap.php' => <<<'XML'
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://www.maxximastyle.com/xmlsitemap.php?type=pages&amp;page=1</loc></sitemap>
  <sitemap><loc>https://www.maxximastyle.com/xmlsitemap.php?type=products&amp;page=1</loc></sitemap>
</sitemapindex>
XML,
            'https://www.maxximastyle.com/xmlsitemap.php?type=pages&page=1' => '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.maxximastyle.com/about-us/</loc></url></urlset>',
            'https://www.maxximastyle.com/xmlsitemap.php?type=products&page=1' => <<<'XML'
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.maxximastyle.com/led-wall-light-msl-123/</loc></url>
  <url><loc>https://www.maxximastyle.com/cart.php</loc></url>
</urlset>
XML,
        ]);

        $urls = $this->service()->discoverProductUrls('https://www.maxximastyle.com', 10);

        $this->assertSame([
            'https://www.maxximastyle.com/led-wall-light-msl-123/',
        ], $urls);
    }

    public function test_discovers_shopify_products_from_product_sitemap_feed(): void
    {
        $this->fakeStoreResponses('https://demo-store.myshopify.com', [
            'https://demo-store.myshopify.com/sitemap.xml' => <<<'XML'
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://demo-store.myshopify.com/sitemap_products_1.xml</loc></sitemap>
  <sitemap><loc>https://demo-store.myshopify.com/sitemap_collections_1.xml</loc></sitemap>
</sitemapindex>
XML,
            'https://demo-store.myshopify.com/sitemap_products_1.xml' => <<<'XML'
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://demo-store.myshopify.com/products/test-product</loc></url>
</urlset>
XML,
            'https://demo-store.myshopify.com/sitemap_collections_1.xml' => <<<'XML'
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://demo-store.myshopify.com/collections/all</loc></url>
</urlset>
XML,
        ]);

        $urls = $this->service()->discoverProductUrls('https://demo-store.myshopify.com', 10);

        $this->assertSame([
            'https://demo-store.myshopify.com/products/test-product',
        ], $urls);
    }

    public function test_discovers_woocommerce_products_from_product_sitemap_feed(): void
    {
        $this->fakeStoreResponses('https://woo.example.com', [
            'https://woo.example.com/sitemap.xml' => Http::response('', 404),
            'https://woo.example.com/wp-sitemap.xml' => <<<'XML'
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://woo.example.com/wp-sitemap-posts-product-1.xml</loc></sitemap>
  <sitemap><loc>https://woo.example.com/wp-sitemap-posts-page-1.xml</loc></sitemap>
</sitemapindex>
XML,
            'https://woo.example.com/wp-sitemap-posts-product-1.xml' => <<<'XML'
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://woo.example.com/product/sample-product/</loc></url>
</urlset>
XML,
            'https://woo.example.com/wp-sitemap-posts-page-1.xml' => <<<'XML'
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://woo.example.com/about/</loc></url>
</urlset>
XML,
        ]);

        $urls = $this->service()->discoverProductUrls('https://woo.example.com', 10);

        $this->assertSame([
            'https://woo.example.com/product/sample-product/',
        ], $urls);
    }

    public function test_discovers_wix_products_from_store_products_sitemap(): void
    {
        $this->fakeStoreResponses('https://shop.wix.example.com', [
            'https://shop.wix.example.com/sitemap.xml' => <<<'XML'
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://shop.wix.example.com/store-products-sitemap.xml</loc></sitemap>
</sitemapindex>
XML,
            'https://shop.wix.example.com/store-products-sitemap.xml' => <<<'XML'
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://shop.wix.example.com/product-page/blue-lamp</loc></url>
</urlset>
XML,
        ]);

        $urls = $this->service()->discoverProductUrls('https://shop.wix.example.com', 10);

        $this->assertSame([
            'https://shop.wix.example.com/product-page/blue-lamp',
        ], $urls);
    }

    public function test_discovers_squarespace_products_from_shop_path(): void
    {
        $this->fakeStoreResponses('https://www.example.com', [
            'https://www.example.com/sitemap.xml' => <<<'XML'
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.example.com/shop/p/sample-product</loc></url>
  <url><loc>https://www.example.com/about</loc></url>
</urlset>
XML,
        ]);

        $urls = $this->service()->discoverProductUrls('https://www.example.com', 10);

        $this->assertSame([
            'https://www.example.com/shop/p/sample-product',
        ], $urls);
    }

    public function test_discovers_opencart_products_from_route_query(): void
    {
        $this->fakeStoreResponses('https://opencart.example.com', [
            'https://opencart.example.com/sitemap.xml' => <<<'XML'
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://opencart.example.com/index.php?route=product/product&amp;product_id=42</loc></url>
  <url><loc>https://opencart.example.com/index.php?route=information/information&amp;information_id=4</loc></url>
</urlset>
XML,
        ]);

        $urls = $this->service()->discoverProductUrls('https://opencart.example.com', 10);

        $this->assertSame([
            'https://opencart.example.com/index.php?route=product/product&product_id=42',
        ], $urls);
    }

    public function test_discovers_prestashop_products_from_product_sitemap_feed(): void
    {
        $this->fakeStoreResponses('https://prestashop.example.com', [
            'https://prestashop.example.com/robots.txt' => "User-agent: *\nSitemap: https://prestashop.example.com/1_index_sitemap.xml\n",
            'https://prestashop.example.com/1_index_sitemap.xml' => <<<'XML'
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://prestashop.example.com/1_en_0_sitemap.xml</loc></sitemap>
  <sitemap><loc>https://prestashop.example.com/1_en_1_sitemap.xml</loc></sitemap>
</sitemapindex>
XML,
            'https://prestashop.example.com/1_en_0_sitemap.xml' => <<<'XML'
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://prestashop.example.com/3-category.html</loc></url>
</urlset>
XML,
            'https://prestashop.example.com/1_en_1_sitemap.xml' => <<<'XML'
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://prestashop.example.com/12-sample-product.html</loc></url>
</urlset>
XML,
        ]);

        $urls = $this->service()->discoverProductUrls('https://prestashop.example.com', 10);

        $this->assertSame([
            'https://prestashop.example.com/12-sample-product.html',
        ], $urls);
    }

    public function test_discovers_magento_products_from_catalog_product_path(): void
    {
        $this->fakeStoreResponses('https://magento.example.com', [
            'https://magento.example.com/sitemap.xml' => <<<'XML'
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://magento.example.com/catalog/product/view/id/12/s/sample-product/</loc></url>
  <url><loc>https://magento.example.com/about-us</loc></url>
</urlset>
XML,
        ]);

        $urls = $this->service()->discoverProductUrls('https://magento.example.com', 10);

        $this->assertSame([
            'https://magento.example.com/catalog/product/view/id/12/s/sample-product/',
        ], $urls);
    }

    public function test_discovers_square_products_from_product_path(): void
    {
        $this->fakeStoreResponses('https://demo.square.site', [
            'https://demo.square.site/sitemap.xml' => <<<'XML'
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://demo.square.site/product/sample-item</loc></url>
  <url><loc>https://demo.square.site/about</loc></url>
</urlset>
XML,
        ]);

        $urls = $this->service()->discoverProductUrls('https://demo.square.site', 10);

        $this->assertSame([
            'https://demo.square.site/product/sample-item',
        ], $urls);
    }

    public function test_matches_product_urls_when_store_uses_www_and_user_enters_bare_domain(): void
    {
        $this->fakeStoreResponses('https://maxximastyle.com', [
            'https://maxximastyle.com/xmlsitemap.php' => <<<'XML'
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://www.maxximastyle.com/xmlsitemap.php?type=products&amp;page=1</loc></sitemap>
</sitemapindex>
XML,
            'https://www.maxximastyle.com/xmlsitemap.php?type=products&page=1' => <<<'XML'
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.maxximastyle.com/sample-product/</loc></url>
</urlset>
XML,
        ]);

        $urls = $this->service()->discoverProductUrls('https://maxximastyle.com', 10);

        $this->assertSame([
            'https://www.maxximastyle.com/sample-product/',
        ], $urls);
    }

    private function service(): StoreSitemapService
    {
        return new StoreSitemapService(new StorefrontSessionService);
    }

  /**
     * @param  array<string, string|\Illuminate\Http\Client\Response>  $responses
     */
    private function fakeStoreResponses(string $baseUrl, array $responses): void
    {
        $defaults = [
            $baseUrl.'/sitemap.xml' => Http::response('', 404),
            $baseUrl.'/sitemap_index.xml' => Http::response('', 404),
            $baseUrl.'/sitemap-index.xml' => Http::response('', 404),
            $baseUrl.'/wp-sitemap.xml' => Http::response('', 404),
            $baseUrl.'/sitemap/sitemap.xml' => Http::response('', 404),
            $baseUrl.'/xmlsitemap.php' => Http::response('', 404),
            $baseUrl.'/store-products-sitemap.xml' => Http::response('', 404),
            $baseUrl => Http::response('<html><body>Store</body></html>', 200),
            $baseUrl.'/robots.txt' => Http::response("User-agent: *\n", 200),
        ];

        foreach ($responses as $url => $body) {
            $defaults[$url] = is_string($body) ? Http::response($body, 200) : $body;
        }

        Http::preventStrayRequests();

        Http::fake(function ($request) use ($defaults) {
            $url = (string) $request->url();

            if (isset($defaults[$url])) {
                return $defaults[$url];
            }

            $normalized = $this->normalizeFakeUrl($url);

            foreach ($defaults as $pattern => $response) {
                if ($this->normalizeFakeUrl($pattern) === $normalized) {
                    return $response;
                }
            }

            return Http::response('', 404);
        });
    }

    private function normalizeFakeUrl(string $url): string
    {
        $parts = parse_url($url);
        if ($parts === false) {
            return $url;
        }

        $host = strtolower(preg_replace('/^www\./', '', $parts['host'] ?? '') ?? '');
        $path = $parts['path'] ?? '';
        $query = $parts['query'] ?? '';

        return $host.$path.($query !== '' ? '?'.$query : '');
    }
}
