<?php

$source = $argv[1] ?? (__DIR__ . '/../public/favicon-original.png');
$target = $argv[2] ?? (__DIR__ . '/../public/favicon.png');

$bytes = file_get_contents($source, false, null, 0, 4);
$img = false;

if ($bytes === "\x89PNG") {
    $img = imagecreatefrompng($source);
} elseif (strncmp($bytes, "\xFF\xD8", 2) === 0) {
    $img = imagecreatefromjpeg($source);
} else {
    $img = imagecreatefrompng($source) ?: imagecreatefromjpeg($source);
}

if ($img === false) {
    fwrite(STDERR, "Failed to load image: {$source}\n");
    exit(1);
}

$width = imagesx($img);
$height = imagesy($img);

$output = imagecreatetruecolor($width, $height);
imagealphablending($output, false);
imagesavealpha($output, true);

$transparent = imagecolorallocatealpha($output, 0, 0, 0, 127);
imagefill($output, 0, 0, $transparent);

$threshold = 72;
$visited = array_fill(0, $width * $height, false);

$isBackground = static function (int $rgba) use ($threshold): bool {
    $r = ($rgba >> 16) & 0xFF;
    $g = ($rgba >> 8) & 0xFF;
    $b = $rgba & 0xFF;

    return max($r, $g, $b) <= $threshold;
};

$queue = [];
$seed = static function (int $x, int $y) use (&$queue, $img, $isBackground, $width, $height, &$visited): void {
    if ($x < 0 || $y < 0 || $x >= $width || $y >= $height) {
        return;
    }

    $index = $y * $width + $x;
    if ($visited[$index]) {
        return;
    }

    $rgba = imagecolorat($img, $x, $y);
    if (!$isBackground($rgba)) {
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
        if (!$isBackground($rgba)) {
            continue;
        }

        $visited[$index] = true;
        $queue[] = [$nx, $ny];
    }
}

for ($x = 0; $x < $width; $x++) {
    for ($y = 0; $y < $height; $y++) {
        $index = $y * $width + $x;
        if ($visited[$index]) {
            continue;
        }

        $rgba = imagecolorat($img, $x, $y);
        $r = ($rgba >> 16) & 0xFF;
        $g = ($rgba >> 8) & 0xFF;
        $b = $rgba & 0xFF;
        $max = max($r, $g, $b);

        if ($max <= $threshold + 30) {
            $alpha = (int) round(127 * (1 - max(0, $max - $threshold) / 30));
            $color = imagecolorallocatealpha($output, $r, $g, $b, max(0, min(127, $alpha)));
        } else {
            $color = imagecolorallocatealpha($output, $r, $g, $b, 0);
        }

        imagesetpixel($output, $x, $y, $color);
    }
}

$trimmed = trimTransparent($output);
imagedestroy($output);

$canvasSize = 512;
$paddingRatio = 0.06;
$scaled = scaleToSquare($trimmed, $canvasSize, $paddingRatio);
imagedestroy($trimmed);

imagepng($scaled, $target);
imagedestroy($img);
imagedestroy($scaled);

echo "Saved transparent favicon to {$target} ({$canvasSize}x{$canvasSize})\n";

function trimTransparent($img)
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
        return $img;
    }

    $cropWidth = $maxX - $minX + 1;
    $cropHeight = $maxY - $minY + 1;
    $cropped = imagecreatetruecolor($cropWidth, $cropHeight);
    imagealphablending($cropped, false);
    imagesavealpha($cropped, true);
    $transparent = imagecolorallocatealpha($cropped, 0, 0, 0, 127);
    imagefill($cropped, 0, 0, $transparent);
    imagecopy($cropped, $img, 0, 0, $minX, $minY, $cropWidth, $cropHeight);

    return $cropped;
}

function scaleToSquare($img, int $size, float $paddingRatio)
{
    $srcWidth = imagesx($img);
    $srcHeight = imagesy($img);
    $usable = (int) round($size * (1 - ($paddingRatio * 2)));
    $scale = min($usable / $srcWidth, $usable / $srcHeight);
    $targetWidth = max(1, (int) round($srcWidth * $scale));
    $targetHeight = max(1, (int) round($srcHeight * $scale));

    $canvas = imagecreatetruecolor($size, $size);
    imagealphablending($canvas, false);
    imagesavealpha($canvas, true);
    $transparent = imagecolorallocatealpha($canvas, 0, 0, 0, 127);
    imagefill($canvas, 0, 0, $transparent);

    $offsetX = (int) round(($size - $targetWidth) / 2);
    $offsetY = (int) round(($size - $targetHeight) / 2);

    imagecopyresampled(
        $canvas,
        $img,
        $offsetX,
        $offsetY,
        0,
        0,
        $targetWidth,
        $targetHeight,
        $srcWidth,
        $srcHeight
    );

    return $canvas;
}
