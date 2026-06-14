import chromadb
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")
client = chromadb.PersistentClient(path="chroma_db")
col = client.get_collection("ncert_textbooks")

query = "xylem and phloem"
embedding = model.encode([query]).tolist()
results = col.query(query_embeddings=embedding, n_results=5)

print(f"Query: {query}")
print("=" * 60)
for i in range(len(results["ids"][0])):
    meta = results["metadatas"][0][i]
    dist = results["distances"][0][i]
    doc = results["documents"][0][i][:250]
    cls = meta.get("class", "?")
    subj = meta.get("subject", "?")
    ch = meta.get("chapter", "?")
    pg = meta.get("page", "?")
    print(f"\nRank {i+1} (distance: {dist:.3f})")
    print(f"  Class {cls} {subj}, Ch.{ch}, Page {pg}")
    print(f"  {doc}...")
