import argparse
from pathlib import Path

from app.extraction.page_text import extract_pages, save_page_text
from app.rag.chunking import chunk_pages
from app.rag.retriever import ChromaRetriever
from app.providers.embeddings import embedding_model
from app import config
import chromadb

def main():
    parser = argparse.ArgumentParser(description="Index a Scheme PDF into Chroma DB")
    parser.add_argument("pdf_path", type=str, help="Path to the PDF file")
    parser.add_argument("--scheme_id", type=str, required=True, help="Scheme ID (e.g. pm-kisan)")
    parser.add_argument("--state", type=str, default="ALL", help="State of the scheme")
    parser.add_argument("--version", type=int, default=1, help="Scheme version")
    args = parser.parse_args()
    
    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        print(f"Error: {pdf_path} not found.")
        return

    print(f"1. Extracting text from {pdf_path}...")
    doc_text = extract_pages(pdf_path, doc_id=args.scheme_id)
    
    print(f"2. Chunking {doc_text.page_count} pages...")
    chunks = chunk_pages(
        pages=doc_text.pages,
        scheme_id=args.scheme_id,
        version=args.version,
        state=args.state,
        doc_id=args.scheme_id
    )
    
    print(f"3. Connecting to ChromaDB & Embedding Model...")
    try:
        client = chromadb.PersistentClient(path=str(config.DATA_DIR / "chroma"))
        embedder = embedding_model()
        retriever = ChromaRetriever(client, embedder=embedder)
        
        print(f"4. Indexing {len(chunks)} chunks into Chroma Vector Store...")
        result = retriever.index(chunks, published=True)
        
        print(f"Success! Indexed {result.chunk_count} chunks for {result.scheme_id} v{result.version}.")
        if result.deleted_previous > 0:
            print(f"Replaced {result.deleted_previous} older chunks.")
            
    except Exception as e:
        print(f"Failed to index into Chroma: {e}")
        print("Note: If you see an API key or Model error, you must fix your Gemini API Key in the .env file!")

if __name__ == "__main__":
    main()
