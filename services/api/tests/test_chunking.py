from app.document import chunk_text

def test_chunking():
    chunks=chunk_text('a'*2500,size=1000,overlap=100)
    assert len(chunks)>=3
    assert ''.join(chunks) != ''
