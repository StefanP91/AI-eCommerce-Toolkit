<?php

declare(strict_types=1);

function reencodePng(string $source, string $target): void
{
    $img = imagecreatefrompng($source);
    if ($img === false) {
        throw new RuntimeException("Cannot load {$source}");
    }

    imagealphablending($img, false);
    imagesavealpha($img, true);
    imagepng($img, $target, 6);
    imagedestroy($img);
}

$publicDir = __DIR__ . '/../public';

foreach (
    [
        'logo-text.png',
        'logo-text-light.png',
        'logo-horizontal.png',
        'logo-horizontal-light.png',
        'favicon.png',
    ] as $file
) {
    $path = $publicDir . '/' . $file;
    $tmp = $path . '.tmp';
    reencodePng($path, $tmp);
    rename($tmp, $path);
    echo "Re-encoded {$file}\n";
}
