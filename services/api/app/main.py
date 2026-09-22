import uuid, json, logging
from pathlib import Path
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from .config import get_settings
from .auth import get_current_user, CurrentUser
from .models import ChatRequest, ChatResponse, UserResponse, DocumentResponse, TranscriptionResponse, MemoryRequest
from .db import db_execute, db_fetchall, db_fetchone
from .llm import get_llm
from .rag import RAGService
from .storage import ObjectStorage
from .document import extract_text, chunk_text
from .voice import transcribe_audio, synthesize_piper

logging.basicConfig(level=logging.INFO)
s=get_settings(); app=FastAPI(title=s.app_name, version='1.0.0')
app.add_middleware(CORSMiddleware, allow_origins=[s.web_origin], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

rag=None; storage=None
@app.on_event('startup')
async def startup():
    global rag,storage
    rag=RAGService(); storage=ObjectStorage()

async def ensure_user(user: CurrentUser):
    row=await db_fetchone('SELECT id FROM users WHERE external_id=:e',{'e':user.external_id})
    if not row:
        await db_execute('INSERT INTO users(external_id,name,email,department,role) VALUES(:e,:n,:m,:d,:r)',{'e':user.external_id,'n':user.name,'m':user.email,'d':user.department,'r':user.role})
    return await db_fetchone('SELECT id FROM users WHERE external_id=:e',{'e':user.external_id})

@app.get('/api/v1/health')
async def health(): return {'status':'ok','service':'enterprise-ai','llm_mode':s.llm_mode}

@app.get('/api/v1/me',response_model=UserResponse)
async def me(user: CurrentUser=Depends(get_current_user)):
    await ensure_user(user); return UserResponse(external_id=user.external_id,name=user.name,email=user.email,role=user.role,department=user.department)

@app.get('/api/v1/conversations')
async def conversations(user: CurrentUser=Depends(get_current_user)):
    u=await ensure_user(user)
    rows=await db_fetchall('SELECT id,title,created_at,updated_at FROM conversations WHERE user_id=:u ORDER BY updated_at DESC',{'u':u['id']})
    return [dict(r) for r in rows]

@app.get('/api/v1/conversations/{conversation_id}')
async def conversation(conversation_id:str,user:CurrentUser=Depends(get_current_user)):
    u=await ensure_user(user)
    rows=await db_fetchall('''SELECT m.id,m.role,m.content,m.metadata,m.created_at FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.id=:c AND c.user_id=:u ORDER BY m.created_at''',{'c':conversation_id,'u':u['id']})
    return [dict(r) for r in rows]

@app.post('/api/v1/chat',response_model=ChatResponse)
async def chat(req:ChatRequest,user:CurrentUser=Depends(get_current_user)):
    u=await ensure_user(user)
    cid=req.conversation_id
    if cid:
        conv=await db_fetchone('SELECT id FROM conversations WHERE id=:c AND user_id=:u',{'c':cid,'u':u['id']})
        if not conv: raise HTTPException(404,'Conversation not found')
    else:
        cid=str(uuid.uuid4()); await db_execute('INSERT INTO conversations(id,user_id,title) VALUES(:id,:u,:t)',{'id':cid,'u':u['id'],'t':req.message[:80]})
    history=await db_fetchall('SELECT role,content FROM messages WHERE conversation_id=:c ORDER BY created_at DESC LIMIT :lim',{'c':cid,'lim:s':s.max_history_messages} if False else {'c':cid,'lim':s.max_history_messages})
    history=list(reversed([{'role':x['role'],'content':x['content']} for x in history]))
    citations=[]; context=''
    if req.use_knowledge:
        try:
            hits=rag.search(req.message,s.max_context_chunks)
            for h in hits:
                p=h.payload or {}; citations.append({'document_id':p.get('document_id',''),'filename':p.get('filename',''),'chunk_index':p.get('chunk_index',0),'score':float(h.score)})
            context='\n\n'.join(f"[Source: {p.get('filename')} / chunk {p.get('chunk_index')}]\n{p.get('content','')}" for p in [h.payload or {} for h in hits])
        except Exception as e: logging.warning('RAG unavailable: %s',e)
    system='''You are Enterprise AI, a sovereign internal employee assistant. Answer clearly and safely. Never invent company policy. If knowledge sources are provided, prioritize them and cite them by filename. If evidence is insufficient, say so. Do not expose confidential information outside the user's authorized context.'''
    if context: system += '\n\nEnterprise knowledge:\n'+context
    messages=[{'role':'system','content':system}]+history+[{'role':'user','content':req.message}]
    answer=await get_llm().chat(messages)
    mid=str(uuid.uuid4())
    await db_execute('INSERT INTO messages(id,conversation_id,role,content,metadata) VALUES(:id,:c,:r,:x,:m)',{'id':str(uuid.uuid4()),'c':cid,'r':'user','x':req.message,'m':'{}'})
    await db_execute('INSERT INTO messages(id,conversation_id,role,content,metadata) VALUES(:id,:c,:r,:x,:m)',{'id':mid,'c':cid,'r':'assistant','x':answer,'m':json.dumps({'citations':citations})})
    await db_execute('UPDATE conversations SET updated_at=now() WHERE id=:c',{'c':cid})
    await db_execute('INSERT INTO audit_logs(user_external_id,action,resource,metadata) VALUES(:u,:a,:r,:m)',{'u':user.external_id,'a':'chat','r':cid,'m':json.dumps({'voice_response':req.voice_response})})
    return ChatResponse(conversation_id=cid,message_id=mid,answer=answer,citations=citations,metadata={'voice_available':s.tts_enabled})

@app.post('/api/v1/documents',response_model=DocumentResponse)
async def upload_document(file:UploadFile=File(...),user:CurrentUser=Depends(get_current_user)):
    data=await file.read()
    if len(data)>s.max_upload_mb*1024*1024: raise HTTPException(413,'File too large')
    doc_id=str(uuid.uuid4()); key=f'{user.external_id}/{doc_id}/{file.filename}'
    try:
        storage.put(key,data,file.content_type or 'application/octet-stream')
        text=extract_text(file.filename,data); chunks=chunk_text(text)
        vector_ids=rag.index_chunks(doc_id,file.filename,chunks,{'owner':user.external_id}) if chunks else []
        await db_execute('INSERT INTO documents(id,filename,object_key,mime_type,size_bytes,status,metadata) VALUES(:id,:f,:o,:m,:s,:st,:md)',{'id':doc_id,'f':file.filename,'o':key,'m':file.content_type,'s':len(data),'st':'indexed','md':json.dumps({'owner':user.external_id,'chunks':len(chunks)})})
        for i,(chunk,vid) in enumerate(zip(chunks,vector_ids)):
            await db_execute('INSERT INTO document_chunks(document_id,chunk_index,content,vector_id) VALUES(:d,:i,:c,:v)',{'d':doc_id,'i':i,'c':chunk,'v':vid})
        return DocumentResponse(id=doc_id,filename=file.filename,status='indexed',size_bytes=len(data))
    except Exception as e:
        logging.exception('document indexing failed'); raise HTTPException(500,str(e))

@app.get('/api/v1/documents',response_model=list[DocumentResponse])
async def documents(user:CurrentUser=Depends(get_current_user)):
    rows=await db_fetchall('SELECT id,filename,status,size_bytes FROM documents ORDER BY created_at DESC')
    return [DocumentResponse(id=str(r['id']),filename=r['filename'],status=r['status'],size_bytes=r['size_bytes']) for r in rows]

@app.post('/api/v1/memory')
async def add_memory(req:MemoryRequest,user:CurrentUser=Depends(get_current_user)):
    u=await ensure_user(user)
    mid=str(uuid.uuid4()); await db_execute('INSERT INTO memories(id,user_id,kind,content) VALUES(:id,:u,:k,:c)',{'id':mid,'u':u['id'],'k':req.kind,'c':req.content})
    return {'id':mid,'status':'stored'}

@app.get('/api/v1/memory')
async def list_memory(user:CurrentUser=Depends(get_current_user)):
    u=await ensure_user(user); rows=await db_fetchall('SELECT id,kind,content,created_at FROM memories WHERE user_id=:u ORDER BY created_at DESC',{'u':u['id']}); return [dict(r) for r in rows]

@app.post('/api/v1/voice/transcribe',response_model=TranscriptionResponse)
async def voice_transcribe(file:UploadFile=File(...),user:CurrentUser=Depends(get_current_user)):
    data=await file.read(); text,lang=transcribe_audio(data,Path(file.filename or 'audio.webm').suffix or '.webm'); return TranscriptionResponse(text=text,language=lang)

@app.post('/api/v1/voice/synthesize')
async def voice_synthesize(payload:dict,user:CurrentUser=Depends(get_current_user)):
    text=payload.get('text','')
    if not text: raise HTTPException(400,'text is required')
    try: audio=synthesize_piper(text)
    except RuntimeError as e: raise HTTPException(503,str(e))
    return Response(content=audio,media_type='audio/wav')
