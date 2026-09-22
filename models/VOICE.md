# Voice models

STT uses faster-whisper and downloads its model from the model registry the first time it runs. This is a model download, not an external AI API call.

TTS is disabled by default because voice model files should not be committed to Git. To enable Piper:

1. Put a compatible French Piper `.onnx` model and `.onnx.json` config under `models/piper/`.
2. Set `TTS_ENABLED=true`.
3. Set `PIPER_MODEL_PATH` and `PIPER_CONFIG_PATH` in `.env`.

The browser voice button currently performs push-to-talk: record -> local STT -> assistant -> text. A TTS endpoint is included for the next UI iteration.
