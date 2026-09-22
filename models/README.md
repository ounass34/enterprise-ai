# Local model directory

Models are intentionally not committed to Git.

Recommended initial model:

- LLM: `Qwen/Qwen3-8B`
- Embeddings: `intfloat/multilingual-e5-small`
- STT: faster-whisper `small`
- TTS: Piper French voice, downloaded into `models/piper/`

For production, pin exact model revisions and verify their licenses before deployment.
