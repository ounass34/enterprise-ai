import os, tempfile, subprocess
from faster_whisper import WhisperModel
from .config import get_settings

_model=None

def get_whisper():
    global _model
    if _model is None:
        s=get_settings(); _model=WhisperModel(s.whisper_model, device=s.whisper_device, compute_type=s.whisper_compute_type)
    return _model

def transcribe_audio(data: bytes, suffix='.webm'):
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
        f.write(data); src=f.name
    try:
        segments, info=get_whisper().transcribe(src, vad_filter=True, beam_size=5)
        return ' '.join(x.text.strip() for x in segments), info.language
    finally:
        os.unlink(src)

def synthesize_local(text: str):
    s=get_settings()
    if not s.tts_enabled:
        raise RuntimeError('TTS is disabled')
    # Preferred: Piper when a local model is installed. Fallback: espeak-ng,
    # which is intentionally included so voice mode works immediately.
    if os.path.exists(s.piper_model_path):
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as out:
            out_path=out.name
        try:
            subprocess.run(['python','-m','piper','--model',s.piper_model_path,'--output_file',out_path],input=text.encode(),check=True)
            return open(out_path,'rb').read()
        finally:
            if os.path.exists(out_path): os.unlink(out_path)
    proc=subprocess.run(['espeak-ng','-v','fr','-s','155','-w','/tmp/enterprise-ai-tts.wav',text],check=True)
    data=open('/tmp/enterprise-ai-tts.wav','rb').read()
    try: os.remove('/tmp/enterprise-ai-tts.wav')
    except OSError: pass
    return data

synthesize_piper=synthesize_local
