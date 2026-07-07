<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiClientService
{
    public function provider(): string
    {
        return config('services.ai.provider', 'gemini');
    }

    public function isConfigured(): bool
    {
        return match ($this->provider()) {
            'openai' => ! empty(config('services.openai.api_key')),
            default => ! empty(config('services.gemini.api_key')),
        };
    }

    /**
     * @param  array<int, array{role: string, content: string|array}>  $messages
     * @param  array{temperature?: float, timeout?: int}  $options
     * @return array{ok: bool, data?: array, error?: string, code?: string}
     */
    public function chatJson(array $messages, array $options = []): array
    {
        if (! $this->isConfigured()) {
            return ['ok' => false, 'error' => 'AI API key is not configured.', 'code' => 'missing_api_key'];
        }

        return match ($this->provider()) {
            'openai' => $this->openAiChatJson($messages, $options),
            default => $this->geminiChatJson($messages, $options),
        };
    }

    /**
     * @param  array{temperature?: float, timeout?: int}  $options
     * @return array{ok: bool, data?: array, error?: string, code?: string}
     */
    public function chatJsonWithImage(
        string $userPrompt,
        ?string $systemPrompt,
        string $imageBase64,
        string $mimeType,
        array $options = [],
    ): array {
        if (! $this->isConfigured()) {
            return ['ok' => false, 'error' => 'AI API key is not configured.', 'code' => 'missing_api_key'];
        }

        return match ($this->provider()) {
            'openai' => $this->openAiVisionJson($userPrompt, $imageBase64, $mimeType, $options),
            default => $this->geminiVisionJson($userPrompt, $systemPrompt, $imageBase64, $mimeType, $options),
        };
    }

    private function openAiChatJson(array $messages, array $options): array
    {
        try {
            $response = Http::withToken(config('services.openai.api_key'))
                ->timeout($options['timeout'] ?? 90)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => config('services.openai.model', 'gpt-4o-mini'),
                    'messages' => $messages,
                    'response_format' => ['type' => 'json_object'],
                    'temperature' => $options['temperature'] ?? 0.7,
                ]);

            if (! $response->successful()) {
                $error = $response->json('error.message') ?? 'OpenAI request failed';
                $code = $response->json('error.code') ?? 'api_error';
                Log::warning('OpenAI API error', ['body' => $response->body()]);

                return ['ok' => false, 'error' => $error, 'code' => $code];
            }

            $parsed = json_decode($response->json('choices.0.message.content'), true);

            if (! is_array($parsed)) {
                return ['ok' => false, 'error' => 'Invalid JSON response from OpenAI.', 'code' => 'invalid_response'];
            }

            return ['ok' => true, 'data' => $parsed];
        } catch (\Exception $e) {
            Log::warning('OpenAI request failed', ['message' => $e->getMessage()]);

            return ['ok' => false, 'error' => $e->getMessage(), 'code' => 'api_error'];
        }
    }

    private function openAiVisionJson(string $userPrompt, string $imageBase64, string $mimeType, array $options): array
    {
        $dataUrl = 'data:'.$mimeType.';base64,'.$imageBase64;

        return $this->openAiChatJson([
            [
                'role' => 'user',
                'content' => [
                    ['type' => 'text', 'text' => $userPrompt],
                    ['type' => 'image_url', 'image_url' => ['url' => $dataUrl]],
                ],
            ],
        ], array_merge($options, ['timeout' => $options['timeout'] ?? 60]));
    }

    private function geminiChatJson(array $messages, array $options): array
    {
        try {
            $apiKey = config('services.gemini.api_key');
            $model = config('services.gemini.model', 'gemini-2.0-flash');
            $systemInstruction = null;
            $contents = [];

            foreach ($messages as $message) {
                if ($message['role'] === 'system') {
                    $systemInstruction = [
                        'parts' => [['text' => (string) $message['content']]],
                    ];
                    continue;
                }

                $role = $message['role'] === 'assistant' ? 'model' : 'user';
                $contents[] = [
                    'role' => $role,
                    'parts' => [['text' => $this->messageContentToText($message['content'])]],
                ];
            }

            if (empty($contents)) {
                return ['ok' => false, 'error' => 'No user messages provided.', 'code' => 'invalid_request'];
            }

            $body = [
                'contents' => $contents,
                'generationConfig' => [
                    'responseMimeType' => 'application/json',
                    'temperature' => $options['temperature'] ?? 0.7,
                ],
            ];

            if ($systemInstruction) {
                $body['systemInstruction'] = $systemInstruction;
            }

            $response = Http::timeout($options['timeout'] ?? 90)
                ->withHeaders(['x-goog-api-key' => $apiKey])
                ->post(
                    "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent",
                    $body,
                );

            return $this->parseGeminiResponse($response);
        } catch (\Exception $e) {
            Log::warning('Gemini request failed', ['message' => $e->getMessage()]);

            return ['ok' => false, 'error' => $e->getMessage(), 'code' => 'api_error'];
        }
    }

    private function geminiVisionJson(
        string $userPrompt,
        ?string $systemPrompt,
        string $imageBase64,
        string $mimeType,
        array $options,
    ): array {
        try {
            $apiKey = config('services.gemini.api_key');
            $model = config('services.gemini.model', 'gemini-2.0-flash');

            $body = [
                'contents' => [[
                    'role' => 'user',
                    'parts' => [
                        ['text' => $userPrompt],
                        ['inline_data' => ['mime_type' => $mimeType, 'data' => $imageBase64]],
                    ],
                ]],
                'generationConfig' => [
                    'responseMimeType' => 'application/json',
                    'temperature' => $options['temperature'] ?? 0.4,
                ],
            ];

            if ($systemPrompt) {
                $body['systemInstruction'] = ['parts' => [['text' => $systemPrompt]]];
            }

            $response = Http::timeout($options['timeout'] ?? 60)
                ->withHeaders(['x-goog-api-key' => $apiKey])
                ->post(
                    "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent",
                    $body,
                );

            return $this->parseGeminiResponse($response);
        } catch (\Exception $e) {
            Log::warning('Gemini vision request failed', ['message' => $e->getMessage()]);

            return ['ok' => false, 'error' => $e->getMessage(), 'code' => 'api_error'];
        }
    }

    private function parseGeminiResponse($response): array
    {
        if (! $response->successful()) {
            $error = $response->json('error.message') ?? 'Gemini request failed';
            $code = $response->json('error.status') ?? 'api_error';
            Log::warning('Gemini API error', ['body' => $response->body()]);

            return ['ok' => false, 'error' => $error, 'code' => $code];
        }

        $text = $response->json('candidates.0.content.parts.0.text');
        $parsed = json_decode($text, true);

        if (! is_array($parsed)) {
            return ['ok' => false, 'error' => 'Invalid JSON response from Gemini.', 'code' => 'invalid_response'];
        }

        return ['ok' => true, 'data' => $parsed];
    }

    private function messageContentToText(string|array $content): string
    {
        if (is_string($content)) {
            return $content;
        }

        return json_encode($content, JSON_UNESCAPED_UNICODE) ?: '';
    }
}
