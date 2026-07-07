<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class TranslationService
{
    public function __construct(
        private AiClientService $ai,
    ) {}

    private const LANG_NAMES = [
        'en' => 'English', 'de' => 'German', 'fr' => 'French', 'it' => 'Italian',
        'es' => 'Spanish', 'nl' => 'Dutch', 'sr' => 'Serbian', 'mk' => 'Macedonian',
        'hr' => 'Croatian', 'bg' => 'Bulgarian', 'el' => 'Greek', 'tr' => 'Turkish',
    ];

    public function translate(array $input): array
    {
        $content = $this->resolveContent($input);
        $productName = $input['product_name'] ?? $content['seo_title'] ?? 'Product';
        $source = self::LANG_NAMES[$input['source_language']] ?? $input['source_language'];
        $target = self::LANG_NAMES[$input['target_language']] ?? $input['target_language'];
        $targetCode = $input['target_language'];

        $demoReason = ! $this->ai->isConfigured() ? 'missing_api_key' : 'api_error';
        $demoMessage = ! $this->ai->isConfigured()
            ? 'AI API клучот не е конфигуриран на серверот.'
            : 'AI барањето не успеа — се користи примерен превод.';

        if ($this->ai->isConfigured()) {
            $result = $this->ai->chatJson([
                ['role' => 'system', 'content' => 'You are a professional eCommerce translator. Translate ALL text values to the target language. Return JSON using EXACTLY the same keys as the input object. Do not include explanations. Preserve SEO intent and natural phrasing.'],
                ['role' => 'user', 'content' => "Translate the following product content from {$source} to {$target}. Return JSON with identical keys:\n"
                    .json_encode($content, JSON_UNESCAPED_UNICODE)],
            ], ['temperature' => 0.3, 'timeout' => 90]);

            if ($result['ok'] && is_array($result['data'])) {
                $parsed = $result['data'];
                if (isset($parsed['translated']) && is_array($parsed['translated'])) {
                    $parsed = $parsed['translated'];
                }

                $translated = $this->normalizeTranslated($parsed, $content);
                if ($this->hasRealTranslation($content, $translated)) {
                    return $this->buildResult($translated, $input, $productName, false);
                }

                $demoReason = 'invalid_response';
                $demoMessage = 'AI врати неважечки превод — се користи примерен превод.';
            } else {
                $demoReason = $result['code'] ?? 'api_error';
                $demoMessage = $result['error'] ?? $demoMessage;
                Log::warning('Translation API error', [
                    'provider' => $this->ai->provider(),
                    'error' => $result['error'] ?? 'unknown',
                ]);
            }
        }

        return $this->buildResult(
            $this->demoTranslate($content, $targetCode, $productName),
            $input,
            $productName,
            true,
            $demoReason,
            $demoMessage,
        );
    }

    private function resolveContent(array $input): array
    {
        if (! empty($input['product_id'])) {
            $product = Product::findOrFail($input['product_id']);
            $c = $product->generated_content ?? [];

            $content = array_filter([
                'seo_title' => $c['seo_title'] ?? $product->product_name,
                'description' => $c['description'] ?? '',
                'short_description' => $c['short_description'] ?? '',
                'meta_title' => $c['meta_title'] ?? '',
                'meta_description' => $c['meta_description'] ?? '',
                'image_alt_text' => $c['image_alt_text'] ?? '',
            ], fn ($v) => is_string($v) && trim($v) !== '');

            if (! empty($content)) {
                return $content;
            }
        }

        $content = array_filter([
            'seo_title' => $input['seo_title'] ?? null,
            'description' => $input['description'] ?? null,
            'short_description' => $input['short_description'] ?? null,
            'meta_title' => $input['meta_title'] ?? null,
            'meta_description' => $input['meta_description'] ?? null,
            'image_alt_text' => $input['image_alt_text'] ?? null,
        ], fn ($v) => is_string($v) && trim($v) !== '');

        if (empty($content) && ! empty($input['product_name'])) {
            $name = trim($input['product_name']);
            $content = [
                'seo_title' => $name,
                'description' => "Discover the {$name}. Premium quality, great value, and fast shipping. Perfect for everyday use with reliable performance you can trust.",
                'short_description' => "Premium {$name} with fast shipping and easy returns.",
                'meta_title' => "{$name} | Buy Online Today",
                'meta_description' => "Shop the {$name} online. Top quality, great reviews, and fast delivery. Order today and enjoy hassle-free returns.",
                'image_alt_text' => "{$name} product photo showing design and key features",
            ];
        }

        if (empty($content)) {
            throw new \RuntimeException('Provide at least one content field or a product name to translate.');
        }

        return $content;
    }

    private function normalizeTranslated(array $parsed, array $original): array
    {
        $result = [];
        foreach (array_keys($original) as $key) {
            $result[$key] = trim((string) ($parsed[$key] ?? $original[$key]));
        }

        return $result;
    }

    private function hasRealTranslation(array $original, array $translated): bool
    {
        foreach ($original as $key => $value) {
            if (($translated[$key] ?? '') !== '' && ($translated[$key] ?? '') !== $value) {
                return true;
            }
        }

        return false;
    }

    private function buildResult(
        array $translated,
        array $input,
        string $productName,
        bool $demoMode,
        ?string $demoReason = null,
        ?string $demoMessage = null,
    ): array {
        return [
            'translated' => $translated,
            'source_language' => $input['source_language'],
            'target_language' => $input['target_language'],
            'product_name' => $productName,
            'demo_mode' => $demoMode,
            'demo_reason' => $demoMode ? $demoReason : null,
            'demo_message' => $demoMode ? $demoMessage : null,
        ];
    }

    private function demoTranslate(array $content, string $targetLang, string $productName): array
    {
        $name = $content['seo_title'] ?? $productName;
        $pack = $this->demoPack($targetLang, $name);
        $translated = [];

        foreach ($content as $key => $value) {
            if (isset($pack[$key])) {
                $translated[$key] = $pack[$key];
                continue;
            }

            $translated[$key] = $this->demoTranslateText((string) $value, $targetLang, $name);
        }

        return $translated;
    }

    private function demoPack(string $lang, string $name): array
    {
        $packs = [
            'mk' => [
                'seo_title' => "{$name} | Купи онлајн со брза достава",
                'description' => "Откријте го {$name} — премиум квалитет по одлична цена. Совршен избор за секојдневна употреба со доверлив перформанс и стилен дизајн што можете да им верувате.",
                'short_description' => "Премиум {$name} со брза достава и лесни враќања.",
                'meta_title' => "{$name} | Купи онлајн денес",
                'meta_description' => "Купете {$name} онлајн. Врвен квалитет, одлични рецензии и брза достава. Нарачајте денес и уживајте во безбедно враќање на производот.",
                'image_alt_text' => "{$name} — фотографија на производот со дизајн и клучни карактеристики",
            ],
            'de' => [
                'seo_title' => "{$name} | Online kaufen mit schnellem Versand",
                'description' => "Entdecken Sie {$name} — Premium-Qualität zum fairen Preis. Perfekt für den täglichen Einsatz mit zuverlässiger Leistung und stilvollem Design.",
                'short_description' => "Premium {$name} mit schnellem Versand und einfachen Rückgaben.",
                'meta_title' => "{$name} | Jetzt online kaufen",
                'meta_description' => "Kaufen Sie {$name} online. Top-Qualität, tolle Bewertungen und schnelle Lieferung. Bestellen Sie heute und profitieren Sie von einfachen Rückgaben.",
                'image_alt_text' => "{$name} Produktfoto mit Design und wichtigen Merkmalen",
            ],
            'fr' => [
                'seo_title' => "{$name} | Achetez en ligne avec livraison rapide",
                'description' => "Découvrez {$name} — qualité premium à excellent prix. Parfait pour un usage quotidien avec des performances fiables et un design élégant.",
                'short_description' => "{$name} premium avec livraison rapide et retours faciles.",
                'meta_title' => "{$name} | Achetez en ligne aujourd'hui",
                'meta_description' => "Achetez {$name} en ligne. Qualité supérieure, excellents avis et livraison rapide. Commandez aujourd'hui et profitez de retours faciles.",
                'image_alt_text' => "Photo du produit {$name} montrant le design et les caractéristiques clés",
            ],
            'es' => [
                'seo_title' => "{$name} | Compra online con envío rápido",
                'description' => "Descubre {$name}: calidad premium a un precio excelente. Perfecto para el uso diario con rendimiento fiable y diseño elegante.",
                'short_description' => "{$name} premium con envío rápido y devoluciones fáciles.",
                'meta_title' => "{$name} | Compra online hoy",
                'meta_description' => "Compra {$name} online. Gran calidad, excelentes reseñas y entrega rápida. Pide hoy y disfruta de devoluciones sin complicaciones.",
                'image_alt_text' => "Foto del producto {$name} mostrando diseño y características clave",
            ],
            'it' => [
                'seo_title' => "{$name} | Acquista online con spedizione veloce",
                'description' => "Scopri {$name}: qualità premium a un prezzo eccellente. Perfetto per l'uso quotidiano con prestazioni affidabili e design elegante.",
                'short_description' => "{$name} premium con spedizione veloce e resi facili.",
                'meta_title' => "{$name} | Acquista online oggi",
                'meta_description' => "Acquista {$name} online. Alta qualità, ottime recensioni e consegna rapida. Ordina oggi e approfitta di resi semplici.",
                'image_alt_text' => "Foto del prodotto {$name} che mostra design e caratteristiche principali",
            ],
            'nl' => [
                'seo_title' => "{$name} | Koop online met snelle levering",
                'description' => "Ontdek {$name} — premium kwaliteit voor een uitstekende prijs. Perfect voor dagelijks gebruik met betrouwbare prestaties en stijlvol design.",
                'short_description' => "Premium {$name} met snelle verzending en eenvoudige retourzending.",
                'meta_title' => "{$name} | Koop vandaag online",
                'meta_description' => "Koop {$name} online. Topkwaliteit, geweldige reviews en snelle levering. Bestel vandaag en profiteer van eenvoudige retourzending.",
                'image_alt_text' => "{$name} productfoto met ontwerp en belangrijkste kenmerken",
            ],
            'sr' => [
                'seo_title' => "{$name} | Kupi online sa brzom dostavom",
                'description' => "Otkrijte {$name} — premium kvalitet po odličnoj ceni. Savršen izbor za svakodnevnu upotrebu sa pouzdanim performansama i elegantnim dizajnom.",
                'short_description' => "Premium {$name} sa brzom dostavom i lakim povraćajem.",
                'meta_title' => "{$name} | Kupi online danas",
                'meta_description' => "Kupite {$name} online. Vrhunski kvalitet, odlične recenzije i brza dostava. Poručite danas i uživajte u jednostavnom povraćaju.",
                'image_alt_text' => "{$name} — fotografija proizvoda sa dizajnom i ključnim karakteristikama",
            ],
            'hr' => [
                'seo_title' => "{$name} | Kupi online uz brzu dostavu",
                'description' => "Otkrijte {$name} — vrhunska kvaliteta po odličnoj cijeni. Savršen izbor za svakodnevnu upotrebu uz pouzdane performanse i elegantan dizajn.",
                'short_description' => "Premium {$name} uz brzu dostavu i jednostavan povrat.",
                'meta_title' => "{$name} | Kupi online danas",
                'meta_description' => "Kupite {$name} online. Vrhunska kvaliteta, odlične recenzije i brza dostava. Naručite danas i uživajte u jednostavnom povratu.",
                'image_alt_text' => "{$name} — fotografija proizvoda s dizajnom i ključnim značajkama",
            ],
            'bg' => [
                'seo_title' => "{$name} | Купете онлайн с бърза доставка",
                'description' => "Открийте {$name} — премиум качество на отлична цена. Перфектен избор за ежедневна употреба с надеждна производителност и стилен дизайн.",
                'short_description' => "Премиум {$name} с бърза доставка и лесно връщане.",
                'meta_title' => "{$name} | Купете онлайн днес",
                'meta_description' => "Поръчайте {$name} онлайн. Високо качество, отлични отзиви и бърза доставка. Поръчайте днес и се възползвайте от лесно връщане.",
                'image_alt_text' => "{$name} — снимка на продукта с дизайн и ключови характеристики",
            ],
            'el' => [
                'seo_title' => "{$name} | Αγορά online με γρήγορη παράδοση",
                'description' => "Ανακαλύψτε το {$name} — premium ποιότητα σε εξαιρετική τιμή. Ιδανικό για καθημερινή χρήση με αξιόπιστη απόδοση και κομψό σχεδιασμό.",
                'short_description' => "Premium {$name} με γρήγορη παράδοση και εύκολες επιστροφές.",
                'meta_title' => "{$name} | Αγοράστε online σήμερα",
                'meta_description' => "Αγοράστε {$name} online. Κορυφαία ποιότητα, εξαιρετικές κριτικές και γρήγορη παράδοση. Παραγγείλτε σήμερα με εύκολες επιστροφές.",
                'image_alt_text' => "Φωτογραφία προϊόντος {$name} που δείχνει σχεδιασμό και βασικά χαρακτηριστικά",
            ],
            'tr' => [
                'seo_title' => "{$name} | Hızlı kargo ile online satın alın",
                'description' => "{$name} ile tanışın — mükemmel fiyatla premium kalite. Güvenilir performans ve şık tasarımla günlük kullanım için ideal.",
                'short_description' => "Hızlı kargo ve kolay iade ile premium {$name}.",
                'meta_title' => "{$name} | Bugün online satın alın",
                'meta_description' => "{$name} ürününü online satın alın. Üstün kalite, harika yorumlar ve hızlı teslimat. Bugün sipariş verin, kolay iade avantajından yararlanın.",
                'image_alt_text' => "{$name} ürün fotoğrafı, tasarım ve temel özellikleri gösteriyor",
            ],
            'en' => [
                'seo_title' => "{$name} | Buy Online with Fast Shipping",
                'description' => "Discover {$name} — premium quality at a great price. Perfect for everyday use with reliable performance and stylish design you can trust.",
                'short_description' => "Premium {$name} with fast shipping and easy returns.",
                'meta_title' => "{$name} | Shop Online Today",
                'meta_description' => "Shop {$name} online. Top quality, great reviews, and fast delivery. Order today and enjoy hassle-free returns.",
                'image_alt_text' => "{$name} product photo showing design and key features",
            ],
        ];

        return $packs[$lang] ?? $packs['en'];
    }

    private function demoTranslateText(string $text, string $lang, string $name): string
    {
        $pack = $this->demoPack($lang, $name);

        return $pack['description'] ?? Str::limit($text, 200);
    }
}
