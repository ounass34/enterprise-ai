from pydantic import BaseModel, Field
from typing import Any

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=20000)
    conversation_id: str | None = None
    use_knowledge: bool = True
    voice_response: bool = False

class Citation(BaseModel):
    document_id: str
    filename: str
    chunk_index: int
    score: float

class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    answer: str
    citations: list[Citation] = []
    metadata: dict[str, Any] = {}

class UserResponse(BaseModel):
    external_id: str
    name: str
    email: str
    role: str
    department: str | None

class DocumentResponse(BaseModel):
    id: str
    filename: str
    status: str
    size_bytes: int | None

class TranscriptionResponse(BaseModel):
    text: str
    language: str | None = None

class MemoryRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    kind: str = "user_preference"
