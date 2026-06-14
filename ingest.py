"""
Ingest NCERT PDFs into ChromaDB for RAG.

Usage:
    python ingest.py --pdf_dir textbooks/

Expected structure:
    textbooks/
    ├── class-x-biology/
    │   ├── jesc101.pdf
    │   ├── jesc102.pdf
    │   └── ...
    ├── class-xi-biology/
    │   ├── kebo101.pdf
    │   └── ...
    └── class-xii-biology/
        └── ...

Each subfolder name is parsed as "class-{class}-{subject}".
Each PDF is treated as a chapter/lesson.
"""

import argparse
import re
from pathlib import Path

import chromadb
import fitz  # pymupdf
from sentence_transformers import SentenceTransformer


CHROMA_DIR = "chroma_db"
COLLECTION_NAME = "ncert_textbooks"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 100


def parse_folder_name(folder_name: str) -> dict:
    """Parse 'class-x-biology' into class and subject."""
    parts = folder_name.lower().split("-")
    # Expected: class-{roman/num}-{subject}
    if len(parts) >= 3 and parts[0] == "class":
        class_name = parts[1].upper()  # x, xi, xii -> X, XI, XII
        subject = "-".join(parts[2:]).title()  # biology, physics, etc.
        return {"class": class_name, "subject": subject}
    return {"class": "unknown", "subject": folder_name}


def extract_chapter_number(pdf_name: str) -> str:
    """Extract chapter number from filenames like jesc101.pdf, kebo103.pdf."""
    match = re.search(r"(\d+)", pdf_name)
    if match:
        num = match.group(1)
        # NCERT codes: last 2 digits are chapter, e.g. 101 -> ch 1, 113 -> ch 13
        if len(num) >= 3:
            return str(int(num[-2:]))  # strip leading zeros
        return num
    return pdf_name


def extract_text_from_pdf(pdf_path: Path) -> list[dict]:
    doc = fitz.open(str(pdf_path))
    pages = []
    for page_num, page in enumerate(doc, start=1):
        text = page.get_text()
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        if len(text) > 50:
            pages.append({
                "text": text,
                "page": page_num,
            })
    doc.close()
    return pages


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if len(chunk.strip()) > 20:
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


def discover_pdfs(pdf_dir: Path) -> list[dict]:
    """Walk the folder structure and collect all PDFs with metadata."""
    entries = []

    for subfolder in sorted(pdf_dir.iterdir()):
        if not subfolder.is_dir():
            continue

        folder_meta = parse_folder_name(subfolder.name)
        pdfs = sorted(subfolder.glob("*.pdf"))

        if not pdfs:
            continue

        print(f"\n📁 {subfolder.name} → Class {folder_meta['class']} {folder_meta['subject']} ({len(pdfs)} PDFs)")

        for pdf in pdfs:
            chapter = extract_chapter_number(pdf.stem)
            entries.append({
                "path": pdf,
                "class": folder_meta["class"],
                "subject": folder_meta["subject"],
                "chapter": chapter,
                "filename": pdf.name,
                "folder": subfolder.name,
            })

    # Also pick up any PDFs directly in the root textbooks/ folder
    root_pdfs = sorted(pdf_dir.glob("*.pdf"))
    if root_pdfs:
        print(f"\n📁 (root) → {len(root_pdfs)} PDFs")
        for pdf in root_pdfs:
            entries.append({
                "path": pdf,
                "class": "unknown",
                "subject": "unknown",
                "chapter": extract_chapter_number(pdf.stem),
                "filename": pdf.name,
                "folder": "",
            })

    return entries


def ingest(pdf_dir: str):
    root = Path(pdf_dir)
    if not root.exists():
        print(f"Directory not found: {pdf_dir}")
        return

    entries = discover_pdfs(root)
    if not entries:
        print(f"No PDFs found in {pdf_dir}")
        return

    print(f"\n{'='*50}")
    print(f"Total PDFs found: {len(entries)}")

    print("\nLoading embedding model (first run downloads ~90MB)...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    client = chromadb.PersistentClient(path=CHROMA_DIR)

    existing = [c.name for c in client.list_collections()]
    if COLLECTION_NAME in existing:
        client.delete_collection(COLLECTION_NAME)
        print(f"Cleared existing collection '{COLLECTION_NAME}'")

    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    all_chunks = []
    all_metadatas = []
    all_ids = []

    for entry in entries:
        label = f"Class {entry['class']} {entry['subject']} Ch.{entry['chapter']}"
        print(f"  Processing: {entry['filename']} ({label})")

        pages = extract_text_from_pdf(entry["path"])
        print(f"    → {len(pages)} pages extracted")

        for page_data in pages:
            chunks = chunk_text(page_data["text"])
            for i, chunk in enumerate(chunks):
                chunk_id = f"{entry['folder']}_{entry['path'].stem}_p{page_data['page']}_c{i}"
                all_chunks.append(chunk)
                all_metadatas.append({
                    "source": entry["filename"],
                    "folder": entry["folder"],
                    "class": entry["class"],
                    "subject": entry["subject"],
                    "chapter": entry["chapter"],
                    "page": page_data["page"],
                    "chunk_index": i,
                })
                all_ids.append(chunk_id)

    print(f"\n{'='*50}")
    print(f"Total chunks: {len(all_chunks)}")
    print("Generating embeddings...")

    embeddings = model.encode(all_chunks, show_progress_bar=True, batch_size=64)

    batch_size = 5000
    for start in range(0, len(all_chunks), batch_size):
        end = start + batch_size
        collection.add(
            ids=all_ids[start:end],
            documents=all_chunks[start:end],
            metadatas=all_metadatas[start:end],
            embeddings=embeddings[start:end].tolist(),
        )
        print(f"  Stored batch {start}-{min(end, len(all_chunks))}")

    print(f"\nDone! Stored {len(all_chunks)} chunks in ChromaDB at '{CHROMA_DIR}/'")

    # Print summary
    classes = set(e["class"] for e in entries)
    subjects = set(e["subject"] for e in entries)
    print(f"\nCoverage: {len(classes)} class(es) × {len(subjects)} subject(s)")
    for cls in sorted(classes):
        for subj in sorted(subjects):
            count = sum(1 for e in entries if e["class"] == cls and e["subject"] == subj)
            if count:
                print(f"  Class {cls} {subj}: {count} chapters")

    print("\nYou can now start the server with: python server.py")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest NCERT PDFs for RAG")
    parser.add_argument("--pdf_dir", default="textbooks", help="Root directory containing class folders")
    args = parser.parse_args()
    ingest(args.pdf_dir)
