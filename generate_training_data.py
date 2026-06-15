"""
Generate synthetic teacher-student conversation pairs from textbook chunks.

Uses Claude API to create high-quality training data in the Padhai Buddy
teaching style (conversational, Hinglish-friendly, accurate analogies).

Output: training_data.jsonl — ready for import into Kiln AI or HuggingFace.

Usage:
    python generate_training_data.py --api_key YOUR_ANTHROPIC_KEY
    python generate_training_data.py --api_key YOUR_ANTHROPIC_KEY --count 100 --lang hinglish
"""

import argparse
import csv
import json
import random
import time
from pathlib import Path

import chromadb
from openai import OpenAI

CHROMA_DIR = "chroma_db"
COLLECTION_NAME = "ncert_textbooks"
OUTPUT_FILE = "training_data.csv"

GENERATION_PROMPT = """You are generating training data for an AI tutor called "Padhai Buddy" that teaches Indian school students.

Given a textbook passage, create a realistic 4-turn conversation between a student and the tutor.

RULES:
- Language: {lang_instruction}
- The student asks a genuine doubt about the content — not just "explain this topic" but a specific question a real student would ask.
- The tutor explains using accurate, relatable analogies from Indian daily life. EVERY analogy must be factually correct — the real-world object must actually work the way you describe.
- The tutor asks a follow-up question to check understanding.
- The student responds (sometimes correctly, sometimes with a misconception).
- The tutor either confirms and extends, or gently corrects.
- Tone: like a caring senior talking to a younger sibling. Never condescending.
- Keep responses concise — 2-4 sentences per tutor turn, not paragraphs.

TEXTBOOK PASSAGE:
Subject: {subject}, Class: {class_level}, Chapter: {chapter}
---
{chunk}
---

Output ONLY a JSON array of messages, no other text:
[
  {{"role": "user", "content": "student's question"}},
  {{"role": "assistant", "content": "tutor's response"}},
  {{"role": "user", "content": "student's follow-up"}},
  {{"role": "assistant", "content": "tutor's follow-up response"}}
]"""

LANG_INSTRUCTIONS = {
    "english": "Reply fully in English. Use simple words a Class 10 student would understand.",
    "hinglish": "Reply in Hinglish — Hindi words in Roman/Latin script mixed with English. Example: 'Dekhiye, jab food stomach mein jaata hai, toh HCl acid proteins ko todna shuru karta hai.'",
    "hindi": "Reply in Hindi using Devanagari script. Technical/scientific terms can be in English.",
}


def get_diverse_chunks(collection, count, seed=42):
    """Sample chunks spread across different classes/chapters."""
    all_results = collection.get(include=["documents", "metadatas"])
    docs = all_results["documents"]
    metas = all_results["metadatas"]

    paired = list(zip(docs, metas))
    random.seed(seed)
    random.shuffle(paired)

    # Prioritize diversity: try to cover different class+chapter combos
    seen_keys = set()
    selected = []
    remaining = []

    for doc, meta in paired:
        key = f"{meta['class']}_{meta['subject']}_{meta['chapter']}"
        if key not in seen_keys:
            seen_keys.add(key)
            selected.append((doc, meta))
        else:
            remaining.append((doc, meta))

    # Fill up to count
    selected.extend(remaining)
    selected = selected[:count]

    # Filter out very short chunks
    selected = [(d, m) for d, m in selected if len(d.strip()) > 100]
    return selected[:count]


def generate_conversation(client, chunk, meta, lang="hinglish"):
    prompt = GENERATION_PROMPT.format(
        lang_instruction=LANG_INSTRUCTIONS.get(lang, LANG_INSTRUCTIONS["hinglish"]),
        subject=meta.get("subject", "unknown"),
        class_level=meta.get("class", "unknown"),
        chapter=meta.get("chapter", "unknown"),
        chunk=chunk,
    )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.choices[0].message.content.strip()

    # Parse JSON from response
    start = text.find("[")
    end = text.rfind("]") + 1
    if start == -1 or end == 0:
        return None

    messages = json.loads(text[start:end])

    if not isinstance(messages, list) or len(messages) < 4:
        return None

    return messages


def main():
    parser = argparse.ArgumentParser(description="Generate training data from textbook chunks")
    parser.add_argument("--api_key", required=True, help="OpenAI API key")
    parser.add_argument("--count", type=int, default=50, help="Number of conversations to generate (default: 50)")
    parser.add_argument("--lang", default="hinglish", choices=["english", "hinglish", "hindi"], help="Language for generated conversations")
    parser.add_argument("--output", default=OUTPUT_FILE, help="Output JSONL file path")
    args = parser.parse_args()

    print("Loading chunks from ChromaDB...")
    chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
    collection = chroma_client.get_collection(COLLECTION_NAME)
    print(f"Total chunks available: {collection.count()}")

    chunks = get_diverse_chunks(collection, args.count)
    print(f"Selected {len(chunks)} diverse chunks for generation")

    client = OpenAI(api_key=args.api_key)

    output_path = Path(args.output)
    generated = 0
    failed = 0

    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["input", "output", "subject", "class", "chapter"])

        for i, (chunk, meta) in enumerate(chunks):
            label = f"Class {meta['class']} {meta['subject']} Ch.{meta['chapter']}"
            print(f"  [{i+1}/{len(chunks)}] {label}...", end=" ")

            try:
                messages = generate_conversation(client, chunk, meta, lang=args.lang)
                if messages:
                    # Pair up: each student message is input, next tutor message is output
                    for j in range(0, len(messages) - 1, 2):
                        if messages[j]["role"] == "user" and messages[j+1]["role"] == "assistant":
                            writer.writerow([
                                messages[j]["content"],
                                messages[j+1]["content"],
                                meta.get("subject", ""),
                                meta.get("class", ""),
                                meta.get("chapter", ""),
                            ])
                    generated += 1
                    print("OK")
                else:
                    failed += 1
                    print("SKIP (bad format)")
            except Exception as e:
                failed += 1
                print(f"FAIL ({e})")

            # Rate limiting
            if i < len(chunks) - 1:
                time.sleep(0.5)

    print(f"\nDone! Generated {generated} conversations, {failed} failed.")
    print(f"Output: {output_path}")
    print(f"\nNext steps:")
    print(f"  1. Open Kiln AI")
    print(f"  2. Create a new project → import {output_path}")
    print(f"  3. Review and curate the conversations")
    print(f"  4. Fine-tune through Kiln's provider integrations")


if __name__ == "__main__":
    main()
