import uuid
from pathlib import Path
from qdrant_client import QdrantClient, models
from sentence_transformers import SentenceTransformer
from .config import get_settings

class RAGService:
    def __init__(self):
        s=get_settings(); self.s=s
        self.client=QdrantClient(url=s.qdrant_url)
        self.embedder=SentenceTransformer(s.embedding_model)
        self.dim=self.embedder.get_sentence_embedding_dimension()
        self._ensure_collection()

    def _ensure_collection(self):
        try: self.client.get_collection(self.s.qdrant_collection)
        except Exception:
            self.client.create_collection(self.s.qdrant_collection, vectors_config=models.VectorParams(size=self.dim, distance=models.Distance.COSINE))

    def embed(self, texts):
        return self.embedder.encode(texts, normalize_embeddings=True).tolist()

    def index_chunks(self, document_id, filename, chunks, metadata=None):
        vectors=self.embed([f"passage: {x}" for x in chunks])
        points=[]
        for i,(chunk,vec) in enumerate(zip(chunks,vectors)):
            vid=str(uuid.uuid4())
            payload={"document_id":document_id,"filename":filename,"chunk_index":i,"content":chunk,**(metadata or {})}
            points.append(models.PointStruct(id=vid,vector=vec,payload=payload))
        self.client.upsert(self.s.qdrant_collection, points=points)
        return [str(p.id) for p in points]

    def search(self, query, limit=6):
        vec=self.embed([f"query: {query}"])[0]
        result=self.client.query_points(collection_name=self.s.qdrant_collection, query=vec, limit=limit, with_payload=True)
        return result.points
