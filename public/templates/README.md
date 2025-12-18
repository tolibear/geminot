# Badge Templates

This folder contains reference badge images used for template matching detection.

## Quick Start - Single Template

**You only need ONE image file:** `badge.png`

Place your sparkle badge template here as `badge.png`. The detection system will automatically use OpenCV's multi-scale matching to detect badges at any size.

## Image Requirements

- **Filename:** `badge.png`
- **Format:** PNG with transparency (recommended) or solid background
- **Content:** The sparkle badge as it appears in images (four-point sparkle inside circle)
- **Size:** Any size works, but 32x32 to 64x64 pixels is optimal
- **Quality:** High resolution, crisp edges for accurate matching

## Advanced: Multiple Sized Templates (Optional)

For potentially better accuracy, you can provide templates at multiple sizes:

- `badge-16.png` (16x16 pixels)
- `badge-24.png` (24x24 pixels)
- `badge-32.png` (32x32 pixels)
- `badge-48.png` (48x48 pixels)
- `badge-64.png` (64x64 pixels)

If these files exist, the system will use them. Otherwise, it will use the single `badge.png` with scale matching.

## Template Matching

The detection system will:

1. Extract the bottom-right 15% ROI from uploaded images
2. Match against these templates at multiple scales
3. Return a confidence score (0-1) indicating badge presence
