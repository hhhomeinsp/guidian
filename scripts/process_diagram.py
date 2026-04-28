#!/usr/bin/env python3
"""
Process a reference diagram through GPT Image 2 and upload to R2.

Usage:
    python3 scripts/process_diagram.py <input_image> <r2_key> [keywords...]

Example:
    python3 scripts/process_diagram.py ~/wall-framing.png diagrams/structural/wall-framing.png \
        "wall framing" "stud wall" "king stud" "top plate"

The processed image will be uploaded to R2 and diagram_references.py will be updated.
"""
from __future__ import annotations
import sys, os, base64, openai, boto3, io, re

def main():
    if len(sys.argv) < 3:
        print("Usage: process_diagram.py <input_image> <r2_key> [keywords...]")
        sys.exit(1)

    input_path = sys.argv[1]
    r2_key = sys.argv[2]
    keywords = tuple(sys.argv[3:]) if len(sys.argv) > 3 else ()

    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        print("ERROR: Set OPENAI_API_KEY env var")
        sys.exit(1)

    r2_endpoint = os.environ.get("S3_ENDPOINT_URL", "")
    r2_access = os.environ.get("S3_ACCESS_KEY", "")
    r2_secret = os.environ.get("S3_SECRET_KEY", "")

    print(f"Processing: {input_path}")
    print(f"→ R2 key: {r2_key}")

    client = openai.OpenAI(api_key=api_key)

    with open(input_path, "rb") as f:
        image_bytes = f.read()

    ext = input_path.lower().split(".")[-1]
    mime = "image/png" if ext == "png" else "image/jpeg"

    prompt = (
        "Recreate this technical diagram as a precise, clean professional illustration "
        "for a home inspection certification course. "
        "Preserve ALL labels exactly as shown with their leader lines pointing to the correct components. "
        "Preserve the exact structure, component positions, and proportions from the original. "
        "One label per component — do not duplicate. "
        "Style: flat professional illustration. "
        "Navy blue (#162D4A) for concrete/structural elements. Warm amber/tan for soil. "
        "Light gray with texture for gravel. Appropriate colors for other materials. "
        "White background. Dark gray legible labels in clean sans-serif font. "
        "All text must be fully legible. Professional home inspection certification training material."
    )

    print("Calling GPT Image 2...")
    result = client.images.edit(
        model="gpt-image-2",
        image=(os.path.basename(input_path), image_bytes, mime),
        prompt=prompt,
        size="1024x1024",
        n=1,
    )

    img_data = base64.b64decode(result.data[0].b64_json)
    print(f"Generated {len(img_data):,} bytes")

    s3 = boto3.client("s3", endpoint_url=r2_endpoint, aws_access_key_id=r2_access,
                      aws_secret_access_key=r2_secret, region_name="auto")
    s3.upload_fileobj(io.BytesIO(img_data), "guidian-courses", r2_key,
                      ExtraArgs={"ContentType": "image/png", "CacheControl": "public, max-age=31536000"})

    r2_url = f"{r2_endpoint}/guidian-courses/{r2_key}"
    print(f"Uploaded → {r2_url}")

    # Update diagram_references.py
    if keywords:
        refs_path = os.path.join(os.path.dirname(__file__), "..", "api", "guidian",
                                 "services", "media", "diagram_references.py")
        refs_path = os.path.normpath(refs_path)
        content = open(refs_path).read()
        new_entry = f"    ({repr(keywords)}, {repr(r2_url)}),\n"
        content = content.replace("_REFERENCE_MAP: list[tuple[tuple[str, ...], str]] = []",
                                  f"_REFERENCE_MAP: list[tuple[tuple[str, ...], str]] = [\n{new_entry}]")
        # If already has entries, append before closing ]
        if "_REFERENCE_MAP: list[tuple[tuple[str, ...], str]] = [" in content:
            content = re.sub(r"(\]\s*\n\n\ndef find_reference_url)", 
                            f"    {repr(keywords)}, {repr(r2_url)}),\n]\\1", content)
        open(refs_path, "w").write(content)
        print(f"Added to diagram_references.py: {keywords}")

    print("Done!")

if __name__ == "__main__":
    main()
