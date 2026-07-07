<?php

namespace App\Services;

class SeoScoreService
{
  public function calculate(array $content): array
  {
    $checks = [
      'title' => $this->checkTitle($content['seo_title'] ?? ''),
      'description' => $this->checkDescription($content['description'] ?? ''),
      'short_description' => $this->checkShortDescription($content['short_description'] ?? ''),
      'meta_title' => $this->checkMetaTitle($content['meta_title'] ?? ''),
      'meta_description' => $this->checkMetaDescription($content['meta_description'] ?? ''),
      'keywords' => $this->checkKeywords($content['keywords'] ?? []),
      'tags' => $this->checkTags($content['tags'] ?? []),
      'alt_text' => $this->checkAltText($content['image_alt_text'] ?? ''),
      'faqs' => $this->checkFaqs($content['faqs'] ?? []),
      'features' => $this->checkFeatures($content['features'] ?? []),
    ];

    $passed = count(array_filter($checks, fn ($c) => $c['passed']));
    $total = count($checks);
    $score = (int) round(($passed / $total) * 100);

    return [
      'score' => $score,
      'checks' => $checks,
    ];
  }

  private function checkTitle(string $title): array
  {
    $len = strlen($title);
    $passed = $len >= 30 && $len <= 70;

    return [
      'label' => 'SEO Title',
      'passed' => $passed,
      'message' => $passed ? 'Good title length' : 'Title should be 30-70 characters',
    ];
  }

  private function checkDescription(string $desc): array
  {
    $len = strlen($desc);
    $passed = $len >= 150 && $len <= 2000;

    return [
      'label' => 'Product Description',
      'passed' => $passed,
      'message' => $passed ? 'Good description length' : 'Description should be 150-2000 characters',
    ];
  }

  private function checkShortDescription(string $desc): array
  {
    $len = strlen($desc);
    $passed = $len >= 50 && $len <= 300;

    return [
      'label' => 'Short Description',
      'passed' => $passed,
      'message' => $passed ? 'Good short description' : 'Short description should be 50-300 characters',
    ];
  }

  private function checkMetaTitle(string $title): array
  {
    $len = strlen($title);
    $passed = $len >= 30 && $len <= 60;

    return [
      'label' => 'Meta Title',
      'passed' => $passed,
      'message' => $passed ? 'Good meta title' : 'Meta title should be 30-60 characters',
    ];
  }

  private function checkMetaDescription(string $desc): array
  {
    $len = strlen($desc);
    $passed = $len >= 120 && $len <= 160;

    return [
      'label' => 'Meta Description',
      'passed' => $passed,
      'message' => $passed ? 'Good meta description' : 'Meta description should be 120-160 characters',
    ];
  }

  private function checkKeywords(array $keywords): array
  {
    $passed = count($keywords) >= 5;

    return [
      'label' => 'Keywords',
      'passed' => $passed,
      'message' => $passed ? 'Good keyword coverage' : 'Add at least 5 keywords',
    ];
  }

  private function checkTags(array $tags): array
  {
    $passed = count($tags) >= 3;

    return [
      'label' => 'Product Tags',
      'passed' => $passed,
      'message' => $passed ? 'Good tag coverage' : 'Add at least 3 product tags',
    ];
  }

  private function checkAltText(string $alt): array
  {
    $passed = strlen($alt) >= 20;

    return [
      'label' => 'Image Alt Text',
      'passed' => $passed,
      'message' => $passed ? 'Good alt text' : 'Alt text should be descriptive (20+ chars)',
    ];
  }

  private function checkFaqs(array $faqs): array
  {
    $passed = count($faqs) >= 3;

    return [
      'label' => 'FAQs',
      'passed' => $passed,
      'message' => $passed ? 'Good FAQ coverage' : 'Add at least 3 FAQs',
    ];
  }

  private function checkFeatures(array $features): array
  {
    $passed = count($features) >= 3;

    return [
      'label' => 'Product Features',
      'passed' => $passed,
      'message' => $passed ? 'Good feature list' : 'Add at least 3 product features',
    ];
  }
}
