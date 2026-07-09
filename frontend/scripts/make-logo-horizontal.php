<?php

declare(strict_types=1);

function loadImage(string $path)
{
    $bytes = file_get_contents($path, false, null, 0, 4);

    if ($bytes === "\x89PNG") {
        return imagecreatefrompng($path);
    }

    if (strncmp($bytes, "\xFF\xD8", 2) === 0) {
        return imagecreatefromjpeg($path);
    }

    return imagecreatefrompng($path) ?: imagecreatefromjpeg($path);
}

function isWhite(int $rgba, int $threshold = 238): bool
{
    $r = ($rgba >> 16) & 0xFF;
    $g = ($rgba >> 8) & 0xFF;
    $b = $rgba & 0xFF;

    return $r >= $threshold && $g >= $threshold && $b >= $threshold;
}

function removeWhiteBackground($img, int $threshold = 238): void
{
    $width = imagesx($img);
    $height = imagesy($img);
    $visited = array_fill(0, $width * $height, false);
    $queue = [];

    $seed = static function (int $x, int $y) use (&$queue, $img, $threshold, $width, $height, &$visited): void {
        if ($x < 0 || $y < 0 || $x >= $width || $y >= $height) {
            return;
        }

        $index = $y * $width + $x;
        if ($visited[$index]) {
            return;
        }

        $rgba = imagecolorat($img, $x, $y);
        if (!isWhite($rgba, $threshold)) {
            return;
        }

        $visited[$index] = true;
        $queue[] = [$x, $y];
    };

    foreach ([0, $width - 1] as $x) {
        for ($y = 0; $y < $height; $y++) {
            $seed($x, $y);
        }
    }

    foreach ([0, $height - 1] as $y) {
        for ($x = 0; $x < $width; $x++) {
            $seed($x, $y);
        }
    }

    while ($queue !== []) {
        [$x, $y] = array_shift($queue);

        foreach ([[-1, 0], [1, 0], [0, -1], [0, 1]] as [$dx, $dy]) {
            $nx = $x + $dx;
            $ny = $y + $dy;
            if ($nx < 0 || $ny < 0 || $nx >= $width || $ny >= $height) {
                continue;
            }

            $index = $ny * $width + $nx;
            if ($visited[$index]) {
                continue;
            }

            $rgba = imagecolorat($img, $nx, $ny);
            if (!isWhite($rgba, $threshold)) {
                continue;
            }

            $visited[$index] = true;
            $queue[] = [$nx, $ny];
        }
    }

    imagealphablending($img, false);
    imagesavealpha($img, true);

    for ($x = 0; $x < $width; $x++) {
        for ($y = 0; $y < $height; $y++) {
            $index = $y * $width + $x;
            if (!$visited[$index]) {
                continue;
            }

            $transparent = imagecolorallocatealpha($img, 255, 255, 255, 127);
            imagesetpixel($img, $x, $y, $transparent);
        }
    }
}

function trimTransparent($img): array
{
    $width = imagesx($img);
    $height = imagesy($img);
    $minX = $width;
    $minY = $height;
    $maxX = 0;
    $maxY = 0;

    for ($x = 0; $x < $width; $x++) {
        for ($y = 0; $y < $height; $y++) {
            $rgba = imagecolorat($img, $x, $y);
            $alpha = ($rgba >> 24) & 0x7F;
            if ($alpha >= 127) {
                continue;
            }

            $minX = min($minX, $x);
            $minY = min($minY, $y);
            $maxX = max($maxX, $x);
            $maxY = max($maxY, $y);
        }
    }

    if ($maxX < $minX || $maxY < $minY) {
        return [$img, 0, 0, $width, $height];
    }

    $cropWidth = $maxX - $minX + 1;
    $cropHeight = $maxY - $minY + 1;
    $cropped = imagecreatetruecolor($cropWidth, $cropHeight);
    imagealphablending($cropped, false);
    imagesavealpha($cropped, true);
    $transparent = imagecolorallocatealpha($cropped, 0, 0, 0, 127);
    imagefill($cropped, 0, 0, $transparent);
    imagecopy($cropped, $img, 0, 0, $minX, $minY, $cropWidth, $cropHeight);

    return [$cropped, $minX, $minY, $cropWidth, $cropHeight];
}

function savePng($img, string $path): void
{
    imagepng($img, $path);
}

function lightenForDarkBg($img)
{
    $width = imagesx($img);
    $height = imagesy($img);
    $output = imagecreatetruecolor($width, $height);
    imagealphablending($output, false);
    imagesavealpha($output, true);
    $transparent = imagecolorallocatealpha($output, 0, 0, 0, 127);
    imagefill($output, 0, 0, $transparent);

    for ($x = 0; $x < $width; $x++) {
        for ($y = 0; $y < $height; $y++) {
            $rgba = imagecolorat($img, $x, $y);
            $alpha = ($rgba >> 24) & 0x7F;
            if ($alpha >= 127) {
                continue;
            }

            $r = ($rgba >> 16) & 0xFF;
            $g = ($rgba >> 8) & 0xFF;
            $b = $rgba & 0xFF;
            $max = max($r, $g, $b);

            if ($max < 120) {
                $r = min(255, (int) round(220 + ($r / 120) * 35));
                $g = min(255, (int) round(220 + ($g / 120) * 35));
                $b = min(255, (int) round(235 + ($b / 120) * 20));
            } else {
                $r = min(255, (int) round($r * 1.08));
                $g = min(255, (int) round($g * 1.08));
                $b = min(255, (int) round($b * 1.08));
            }

            $color = imagecolorallocatealpha($output, $r, $g, $b, $alpha);
            imagesetpixel($output, $x, $y, $color);
        }
    }

    return $output;
}

$publicDir = __DIR__ . '/../public';
$logoPath = $publicDir . '/logo.png';
$iconPath = $publicDir . '/favicon.png';

$logo = loadImage($logoPath);
$logoWidth = imagesx($logo);
$logoHeight = imagesy($logo);

$textTop = (int) round($logoHeight * 0.58);
$textHeight = $logoHeight - $textTop;
$textCrop = imagecreatetruecolor($logoWidth, $textHeight);
imagealphablending($textCrop, false);
imagesavealpha($textCrop, true);
$transparent = imagecolorallocatealpha($textCrop, 255, 255, 255, 0);
imagefill($textCrop, 0, 0, $transparent);
imagecopy($textCrop, $logo, 0, 0, 0, $textTop, $logoWidth, $textHeight);
removeWhiteBackground($textCrop);
[$textTrimmed] = trimTransparent($textCrop);

$textPath = $publicDir . '/logo-text.png';
$textLightPath = $publicDir . '/logo-text-light.png';
savePng($textTrimmed, $textPath);
savePng(lightenForDarkBg($textTrimmed), $textLightPath);

$icon = loadImage($iconPath);
[$iconTrimmed] = trimTransparent($icon);

$iconWidth = imagesx($iconTrimmed);
$iconHeight = imagesy($iconTrimmed);
$textWidth = imagesx($textTrimmed);
$textOnlyHeight = imagesy($textTrimmed);
$gap = (int) round($iconHeight * 0.12);
$targetTextHeight = (int) round($iconHeight * 0.42);
$scaledTextWidth = (int) round($textWidth * ($targetTextHeight / $textOnlyHeight));
$canvasWidth = $iconWidth + $gap + $scaledTextWidth;
$canvasHeight = $iconHeight;

$compose = static function ($textImage, string $outputPath) use (
    $iconTrimmed,
    $iconWidth,
    $iconHeight,
    $gap,
    $targetTextHeight,
    $scaledTextWidth,
    $canvasWidth,
    $canvasHeight
): void {
    $canvas = imagecreatetruecolor($canvasWidth, $canvasHeight);
    imagealphablending($canvas, false);
    imagesavealpha($canvas, true);
    $transparent = imagecolorallocatealpha($canvas, 0, 0, 0, 127);
    imagefill($canvas, 0, 0, $transparent);

    imagecopy($canvas, $iconTrimmed, 0, 0, 0, 0, $iconWidth, $iconHeight);
    imagecopyresampled(
        $canvas,
        $textImage,
        $iconWidth + $gap,
        (int) round(($canvasHeight - $targetTextHeight) / 2),
        0,
        0,
        $scaledTextWidth,
        $targetTextHeight,
        imagesx($textImage),
        imagesy($textImage)
    );

    savePng($canvas, $outputPath);
    imagedestroy($canvas);
};

$compose($textTrimmed, $publicDir . '/logo-horizontal.png');
$compose(lightenForDarkBg($textTrimmed), $publicDir . '/logo-horizontal-light.png');

imagedestroy($logo);
imagedestroy($textCrop);
imagedestroy($textTrimmed);
imagedestroy($icon);
imagedestroy($iconTrimmed);

echo "Generated logo-text.png, logo-text-light.png, logo-horizontal.png, logo-horizontal-light.png\n";
