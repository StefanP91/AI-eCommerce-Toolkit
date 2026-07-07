<?php

namespace App\Services;

use Illuminate\Support\Str;

class ProductContextService
{
    private const TONES = ['professional', 'friendly', 'luxury', 'premium', 'technical', 'casual', 'funny'];

    private const GENERIC_CATEGORIES = ['general', ''];

    public function build(array $input): array
    {
        $name = trim($input['product_name']
            ?? ($input['manual_info'] ? Str::limit($input['manual_info'], 80, '') : 'Premium Product'));

        $tone = $input['tone'] ?? 'professional';
        $category = $input['category'] ?? 'General';
        $country = $input['target_country'] ?? 'US';
        $useCategory = ! $this->isGenericCategory($category);

        $traits = $this->inferTraits($name);
        $style = $this->toneStyle($tone);

        return [
            'name' => $name,
            'tone' => $tone,
            'category' => $category,
            'country' => $country,
            'use_category' => $useCategory,
            'traits' => $traits,
            'style' => $style,
            'title_suffix' => $traits['title_suffix'],
            'type_label' => $traits['type_label'],
        ];
    }

    public function stripFieldLabels(string $text, array $context): string
    {
        $patterns = [
            '/\b'.preg_quote(ucfirst($context['tone']), '/').'\s+'.preg_quote($context['category'], '/').'\b/i',
            '/\b'.preg_quote(ucfirst($context['tone']), '/').'\s+General\b/i',
            '/\ba\s+'.preg_quote(ucfirst($context['tone']), '/').'\s+'.preg_quote($context['category'], '/').'\s+product\b/i',
            '/\b'.preg_quote(ucfirst($context['tone']), '/').'\s+'.preg_quote($context['category'], '/').'\s+with\b/i',
        ];

        foreach ($patterns as $pattern) {
            $text = preg_replace($pattern, $context['name'], $text);
        }

        if ($this->isGenericCategory($context['category'])) {
            $text = preg_replace('/\bGeneral\s+product\b/i', 'product', $text);
            $text = preg_replace('/\bBest General Deals\b/i', 'Best Deals', $text);
            $text = preg_replace('/\bBuy General Online\b/i', 'Shop Online', $text);
        }

        return trim(preg_replace('/\s+/', ' ', $text));
    }

    private function isGenericCategory(string $category): bool
    {
        return in_array(strtolower(trim($category)), self::GENERIC_CATEGORIES, true);
    }

    private function toneStyle(string $tone): array
    {
        return match ($tone) {
            'luxury' => ['adj' => 'elegant', 'verb' => 'elevate', 'feel' => 'sophisticated'],
            'premium' => ['adj' => 'premium', 'verb' => 'enhance', 'feel' => 'refined'],
            'friendly' => ['adj' => 'welcoming', 'verb' => 'brighten', 'feel' => 'warm and inviting'],
            'technical' => ['adj' => 'precision-engineered', 'verb' => 'optimize', 'feel' => 'reliable and efficient'],
            'casual' => ['adj' => 'stylish', 'verb' => 'upgrade', 'feel' => 'easy and practical'],
            'funny' => ['adj' => 'eye-catching', 'verb' => 'transform', 'feel' => 'fun and distinctive'],
            default => ['adj' => 'quality', 'verb' => 'improve', 'feel' => 'reliable and well-crafted'],
        };
    }

    private function inferTraits(string $name): array
    {
        $lower = strtolower($name);

        $rules = [
            ['keys' => ['wall light', 'wall lamp', 'sconce'], 'type' => 'wall light', 'suffix' => 'Modern Wall Lighting for Any Room', 'features' => ['Easy wall-mount installation', 'Soft ambient illumination', 'Sleek space-saving design', 'Complements modern and classic interiors'], 'benefits' => ['Adds warmth without taking floor space', 'Creates a cozy atmosphere in any room', 'Simple to install in bedrooms, hallways, and living areas'], 'tags' => ['wall light', 'home lighting', 'ambient light', 'interior decor', 'wall lamp']],
            ['keys' => ['gaming chair', 'office chair', 'chair'], 'type' => 'chair', 'suffix' => 'Ergonomic Comfort for Long Sessions', 'features' => ['Ergonomic lumbar support', 'Adjustable height and armrests', 'Breathable cushion material', 'Sturdy reinforced base'], 'benefits' => ['Reduces fatigue during long hours', 'Supports healthy posture', 'Built for daily comfort and durability'], 'tags' => ['chair', 'ergonomic', 'office furniture', 'comfort seating', 'home office']],
            ['keys' => ['mouse', 'keyboard', 'headset', 'gaming'], 'type' => 'tech accessory', 'suffix' => 'High-Performance Gear for Daily Use', 'features' => ['Responsive precision performance', 'Comfortable ergonomic design', 'Durable build for daily use', 'Plug-and-play compatibility'], 'benefits' => ['Boosts productivity and control', 'Designed for extended comfortable use', 'Reliable performance you can count on'], 'tags' => ['tech accessory', 'gaming gear', 'computer accessory', 'electronics', 'desk setup']],
            ['keys' => ['phone', 'iphone', 'samsung', 'case'], 'type' => 'mobile accessory', 'suffix' => 'Protection with Everyday Style', 'features' => ['Shock-absorbing protection', 'Slim profile design', 'Precise cutouts for full access', 'Scratch-resistant finish'], 'benefits' => ['Keeps your device safe from drops', 'Maintains a sleek look', 'Easy to install and remove'], 'tags' => ['phone case', 'mobile accessory', 'device protection', 'smartphone', 'accessories']],
            ['keys' => ['watch', 'smartwatch'], 'type' => 'watch', 'suffix' => 'Style Meets Smart Functionality', 'features' => ['Accurate timekeeping', 'Comfortable wrist fit', 'Durable everyday construction', 'Modern versatile design'], 'benefits' => ['Keeps you on schedule in style', 'Pairs with any outfit', 'Built for daily wear'], 'tags' => ['watch', 'wristwear', 'accessories', 'timepiece', 'fashion']],
            ['keys' => ['shirt', 'dress', 'jacket', 'pants', 'hoodie'], 'type' => 'apparel', 'suffix' => 'Comfortable Style for Everyday Wear', 'features' => ['Soft breathable fabric', 'Tailored comfortable fit', 'Easy-care durable material', 'Versatile wardrobe staple'], 'benefits' => ['Looks great for any occasion', 'Comfortable all-day wear', 'Easy to style and maintain'], 'tags' => ['fashion', 'apparel', 'clothing', 'wardrobe', 'style']],
            ['keys' => ['lamp', 'light', 'led', 'bulb'], 'type' => 'lighting', 'suffix' => 'Bright Efficient Lighting Solution', 'features' => ['Energy-efficient illumination', 'Long-lasting performance', 'Even light distribution', 'Modern compact design'], 'benefits' => ['Lowers energy costs over time', 'Creates the perfect ambiance', 'Easy to integrate into any space'], 'tags' => ['lighting', 'led', 'home decor', 'energy efficient', 'interior']],
            ['keys' => ['bag', 'backpack', 'wallet'], 'type' => 'bag', 'suffix' => 'Practical Storage for Daily Life', 'features' => ['Spacious organized compartments', 'Durable weather-resistant material', 'Comfortable carry design', 'Secure closures and pockets'], 'benefits' => ['Keeps essentials organized on the go', 'Built to handle daily use', 'Stylish and functional'], 'tags' => ['bag', 'accessories', 'travel', 'storage', 'everyday carry']],
        ];

        foreach ($rules as $rule) {
            foreach ($rule['keys'] as $key) {
                if (str_contains($lower, $key)) {
                    return [
                        'type_label' => $rule['type'],
                        'title_suffix' => $rule['suffix'],
                        'features' => $rule['features'],
                        'benefits' => $rule['benefits'],
                        'tags' => $rule['tags'],
                    ];
                }
            }
        }

        return [
            'type_label' => 'product',
            'title_suffix' => 'Premium Quality | Shop with Confidence',
            'features' => [
                'Thoughtfully designed for everyday use',
                'Reliable quality you can trust',
                'Great value for the price',
                'Fast and secure shipping available',
            ],
            'benefits' => [
                'Solves a real everyday need',
                'Built to last and perform well',
                'Backed by friendly customer support',
            ],
            'tags' => [Str::slug($name, ' '), 'shop online', 'bestseller', 'quality product', 'new arrival'],
        ];
    }
}
