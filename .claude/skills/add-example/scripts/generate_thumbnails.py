#!/usr/bin/env python3
"""
Thumbnail Generation Script for Example Use Cases

This script:
1. Reads examples-metadata.json
2. Downloads PDF and image files from GitHub CDN
3. Converts PDFs to images (first page only)
4. Generates optimized thumbnails (300x400px)
5. Saves thumbnails to frontend/public/examples/thumbnails/
6. Updates examples-metadata.json with thumbnailPath fields
"""

import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen
from io import BytesIO

try:
    import pypdfium2 as pdfium
    from PIL import Image
except ImportError:
    print("Error: Required packages not installed")
    print("Please run: uv pip install pypdfium2 Pillow")
    sys.exit(1)


# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent
METADATA_PATH = PROJECT_ROOT / "frontend/src/features/examples/data/examples-metadata.json"
IMAGES_DIR = PROJECT_ROOT / "frontend/public/examples/images"

# Image size settings (single size)
IMAGE_WIDTH = 800
IMAGE_HEIGHT = 1200


def download_file(url: str) -> bytes:
    """Download file from URL and return bytes"""
    print(f"  Downloading: {url}")
    try:
        with urlopen(url, timeout=30) as response:
            return response.read()
    except Exception as e:
        print(f"  ⚠️  Failed to download {url}: {e}")
        return None


def pdf_to_image(pdf_bytes: bytes) -> Image.Image:
    """Convert first page of PDF to PIL Image"""
    try:
        pdf = pdfium.PdfDocument(pdf_bytes)
        page = pdf[0]  # First page only

        # Render page to bitmap at 2x scale for better quality
        bitmap = page.render(scale=2)

        # Convert to PIL Image
        pil_image = bitmap.to_pil()
        return pil_image
    except Exception as e:
        print(f"  ⚠️  Failed to convert PDF: {e}")
        return None


def create_thumbnail(image: Image.Image, width: int, height: int) -> Image.Image:
    """Create thumbnail from image, maintaining aspect ratio"""
    # Convert to RGB if needed (removes alpha channel)
    if image.mode in ('RGBA', 'LA', 'P'):
        rgb_image = Image.new('RGB', image.size, (255, 255, 255))
        if image.mode == 'P':
            image = image.convert('RGBA')
        rgb_image.paste(image, mask=image.split()[-1] if 'A' in image.mode else None)
        image = rgb_image

    # Calculate aspect ratio preserving thumbnail size
    img_ratio = image.width / image.height
    thumb_ratio = width / height

    if img_ratio > thumb_ratio:
        # Image is wider - fit to width
        new_width = width
        new_height = int(width / img_ratio)
    else:
        # Image is taller - fit to height
        new_height = height
        new_width = int(height * img_ratio)

    # Resize with high quality
    thumbnail = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    return thumbnail


def txt_to_image(text_content: bytes, filename: str, width: int, height: int) -> Image.Image:
    """Convert text file content to styled image"""
    try:
        from PIL import ImageDraw, ImageFont

        # Decode text content
        text = text_content.decode('utf-8')
        lines = text.split('\n')[:35]  # First 35 lines

        # Create canvas with white background
        image = Image.new('RGB', (width, height), 'white')
        draw = ImageDraw.Draw(image)

        # Try to use Japanese font, fallback to default
        try:
            # Try macOS Japanese fonts
            text_font = ImageFont.truetype('/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc', 22)
        except:
            try:
                # Try alternative font path
                text_font = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 22)
            except:
                # Fallback to default font
                text_font = ImageFont.load_default()

        # Draw text content from the beginning
        y_position = 40
        line_spacing = 32

        for line in lines:
            if y_position > height - 60:  # Leave margin at bottom
                break
            # Truncate long lines
            if len(line) > 50:
                line = line[:47] + '...'
            draw.text((40, y_position), line, fill='#1F2937', font=text_font)
            y_position += line_spacing

        return image

    except Exception as e:
        print(f"  ⚠️  Failed to create text image: {e}")
        return None


def process_file(file_info: dict, example_id: str) -> str:
    """
    Process a single file: download, convert if PDF, create image
    Returns imagePath if successful, None otherwise
    """
    file_id = file_info['id']
    file_name = file_info['name']
    file_url = file_info['url']

    print(f"Processing: {file_name}")

    # Download file
    file_bytes = download_file(file_url)
    if not file_bytes:
        return None

    # Convert to image
    if file_name.lower().endswith('.pdf'):
        image = pdf_to_image(file_bytes)
        if not image:
            return None
        # Create single-size image
        processed_image = create_thumbnail(image, IMAGE_WIDTH, IMAGE_HEIGHT)
    elif file_name.lower().endswith(('.png', '.jpg', '.jpeg')):
        try:
            image = Image.open(BytesIO(file_bytes))
        except Exception as e:
            print(f"  ⚠️  Failed to open image: {e}")
            return None
        # Create single-size image
        processed_image = create_thumbnail(image, IMAGE_WIDTH, IMAGE_HEIGHT)
    elif file_name.lower().endswith('.txt'):
        # For text files, create styled image directly
        processed_image = txt_to_image(file_bytes, file_name, IMAGE_WIDTH, IMAGE_HEIGHT)
        if not processed_image:
            return None
    else:
        print(f"  ⚠️  Unsupported file format: {file_name}")
        return None

    # Save image
    image_dir = IMAGES_DIR / example_id
    image_dir.mkdir(parents=True, exist_ok=True)

    image_filename = f"{file_id}.jpg"
    image_path = image_dir / image_filename

    try:
        processed_image.save(image_path, 'JPEG', quality=85, optimize=True)
        print(f"  ✓ Saved: {image_path.relative_to(PROJECT_ROOT)}")
        return f"/examples/images/{example_id}/{image_filename}"
    except Exception as e:
        print(f"  ⚠️  Failed to save image: {e}")
        return None


def main():
    """Main function to generate all thumbnails"""
    print("=" * 60)
    print("Thumbnail Generation Script")
    print("=" * 60)

    # Check metadata file exists
    if not METADATA_PATH.exists():
        print(f"❌ Error: Metadata file not found at {METADATA_PATH}")
        sys.exit(1)

    # Load metadata
    print(f"\n📖 Loading metadata from: {METADATA_PATH.relative_to(PROJECT_ROOT)}")
    with open(METADATA_PATH, 'r', encoding='utf-8') as f:
        metadata = json.load(f)

    # Create output directory
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    print(f"📁 Images will be saved to: {IMAGES_DIR.relative_to(PROJECT_ROOT)}")

    # Process each language
    total_files = 0
    successful_thumbnails = 0

    for lang in ['en', 'ja']:
        examples = metadata.get(lang, [])
        print(f"\n{'=' * 60}")
        print(f"Processing {lang.upper()} examples ({len(examples)} use cases)")
        print('=' * 60)

        for example in examples:
            example_id = example['id']
            example_name = example['name']

            print(f"\n📋 {example_name} ({example_id})")
            print("-" * 60)

            # Process each file in the example
            for file_info in example['files']:
                total_files += 1
                image_path = process_file(file_info, example_id)

                if image_path:
                    # Add imagePath to file metadata
                    file_info['imagePath'] = image_path
                    successful_thumbnails += 1

    # Save updated metadata
    print(f"\n{'=' * 60}")
    print("💾 Updating metadata file...")
    with open(METADATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"✓ Metadata updated: {METADATA_PATH.relative_to(PROJECT_ROOT)}")

    # Summary
    print(f"\n{'=' * 60}")
    print("✅ Thumbnail generation complete!")
    print('=' * 60)
    print(f"Total files processed: {total_files}")
    print(f"Successful thumbnails: {successful_thumbnails}")
    print(f"Failed: {total_files - successful_thumbnails}")
    print(f"\nImages saved to: {IMAGES_DIR.relative_to(PROJECT_ROOT)}")
    print(f"Metadata updated at: {METADATA_PATH.relative_to(PROJECT_ROOT)}")

    if successful_thumbnails < total_files:
        print("\n⚠️  Some thumbnails failed to generate. Check the output above for details.")
        sys.exit(1)


if __name__ == "__main__":
    main()
