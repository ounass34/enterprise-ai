from pathlib import Path
from pypdf import PdfReader
from docx import Document as DocxDocument

def extract_text(filename: str, data: bytes) -> str:
    ext=Path(filename).suffix.lower()
    if ext=='.pdf':
        import io
        reader=PdfReader(io.BytesIO(data)); return '\n'.join((p.extract_text() or '') for p in reader.pages)
    if ext=='.docx':
        import io
        d=DocxDocument(io.BytesIO(data)); return '\n'.join(p.text for p in d.paragraphs)
    if ext in {'.txt','.md','.csv','.json','.xml','.html'}:
        return data.decode('utf-8', errors='ignore')
    raise ValueError(f'Unsupported document type: {ext}')

def chunk_text(text: str, size=1000, overlap=150):
    text=' '.join(text.split())
    chunks=[]; start=0
    while start < len(text):
        end=min(len(text), start+size); chunks.append(text[start:end])
        if end==len(text): break
        start=max(0,end-overlap)
    return chunks
