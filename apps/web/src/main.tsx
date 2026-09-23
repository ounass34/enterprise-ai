import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bot,
  FileText,
  FolderOpen,
  Menu,
  Mic,
  Paperclip,
  Plus,
  Send,
  Settings,
  Sparkles,
  User,
  X,
  BookOpen,
  MessageSquare,
  Trash2,
  ChevronRight
} from 'lucide-react';

import './style.css';
import { initAuth, authHeaders } from './auth';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
};

function App() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [cid, setCid] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);
  const [user, setUser] = useState<any>();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const media = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    initAuth()
      .then(() =>
        fetch(API + '/api/v1/me', {
          headers: authHeaders()
        })
      )
      .then((r) => r.json())
      .then(setUser)
      .catch(() => {});

    fetch(API + '/api/v1/documents', {
      headers: authHeaders()
    })
      .then((r) => r.json())
      .then(setDocs)
      .catch(() => {});
  }, []);

  async function send(text = input, speak = false) {
    if (!text.trim() || busy) return;

    setInput('');

    setMessages((m) => [
      ...m,
      {
        role: 'user',
        content: text
      }
    ]);

    setBusy(true);

    try {
      const r = await fetch(API + '/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({
          message: text,
          conversation_id: cid,
          use_knowledge: true
        })
      });

      const d = await r.json();

      if (!r.ok) {
        throw new Error(d.detail || 'Request failed');
      }

      setCid(d.conversation_id);

      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: d.answer,
          citations: d.citations
        }
      ]);

      if (speak) {
        try {
          const ar = await fetch(API + '/api/v1/voice/synthesize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders()
            },
            body: JSON.stringify({
              text: d.answer
            })
          });

          if (ar.ok) {
            const audio = new Audio(
              URL.createObjectURL(await ar.blob())
            );

            await audio.play();
          }
        } catch (_) {}
      }
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: 'Une erreur est survenue : ' + e.message
        }
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function startRec() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    const rec = new MediaRecorder(stream);

    media.current = rec;
    chunks.current = [];

    rec.ondataavailable = (e) => {
      chunks.current.push(e.data);
    };

    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());

      const blob = new Blob(chunks.current, {
        type: 'audio/webm'
      });

      const fd = new FormData();
      fd.append('file', blob, 'voice.webm');

      setBusy(true);

      try {
        const r = await fetch(API + '/api/v1/voice/transcribe', {
          method: 'POST',
          headers: authHeaders(),
          body: fd
        });

        const d = await r.json();

        if (d.text) {
          setBusy(false);
          await send(d.text, true);
        }
      } finally {
        setBusy(false);
      }
    };

    rec.start();
    setRecording(true);
  }

  function stopRec() {
    media.current?.stop();
    setRecording(false);
  }

  async function upload(e: any) {
    const file = e.target.files?.[0];

    if (!file) return;

    const fd = new FormData();
    fd.append('file', file);

    const r = await fetch(API + '/api/v1/documents', {
      method: 'POST',
      headers: authHeaders(),
      body: fd
    });

    const d = await r.json();

    if (r.ok) {
      setDocs((x) => [d, ...x]);
    } else {
      alert(d.detail || 'Upload failed');
    }
  }

  function newChat() {
    setMessages([]);
    setCid(undefined);
    setInput('');
    setSidebarOpen(false);
  }

  const firstName =
    user?.name?.split(' ')[0] || 'Employee';

  return (
    <div className="app-shell">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>

        <div className="sidebar-top">

          <div className="brand">
            <div className="brand-logo">
              <Sparkles size={21} />
            </div>

            <div>
              <div className="brand-name">
                SOCAD'EL AI
              </div>

              <div className="brand-subtitle">
                Intelligent Workplace
              </div>
            </div>
          </div>

          <button
            className="mobile-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>

        </div>

        <button
          className="new-chat-button"
          onClick={newChat}
        >
          <Plus size={19} />
          <span>New conversation</span>
        </button>

        <div className="sidebar-section">

          <div className="section-title">
            <span>Workspace</span>
          </div>

          <button className="sidebar-item active">
            <MessageSquare size={18} />
            <span>Assistant</span>
          </button>

          <button className="sidebar-item">
            <BookOpen size={18} />
            <span>Knowledge base</span>
          </button>

          <button className="sidebar-item">
            <FolderOpen size={18} />
            <span>Documents</span>
          </button>

        </div>

        <div className="sidebar-section knowledge-section">

          <div className="section-title">
            <span>Knowledge</span>

            <label className="add-document">
              <Plus size={15} />
              <input
                type="file"
                hidden
                accept=".pdf,.docx,.txt,.md,.csv,.json"
                onChange={upload}
              />
            </label>
          </div>

          <div className="documents">

            {docs.length === 0 && (
              <div className="empty-documents">
                <FileText size={18} />
                <span>No documents yet</span>
              </div>
            )}

            {docs.slice(0, 8).map((d) => (
              <div className="document-item" key={d.id}>
                <div className="document-icon">
                  <FileText size={15} />
                </div>

                <span title={d.filename}>
                  {d.filename}
                </span>
              </div>
            ))}

          </div>

        </div>

        <div className="sidebar-bottom">

          <button className="sidebar-item">
            <Settings size={18} />
            <span>Settings</span>
          </button>

          <div className="profile">

            <div className="profile-avatar">
              {user?.name
                ? user.name.charAt(0).toUpperCase()
                : 'U'}
            </div>

            <div className="profile-info">
              <strong>{user?.name || 'Employee'}</strong>
              <span>
                {user?.department || 'Internal User'}
              </span>
            </div>

            <ChevronRight size={16} />

          </div>

        </div>

      </aside>

      {/* MAIN */}
      <main className="main">

        {/* HEADER */}
        <header className="topbar">

          <div className="topbar-left">

            <button
              className="menu-button"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={21} />
            </button>

            <div className="mobile-brand">
              <div className="mobile-brand-logo">
                <Sparkles size={17} />
              </div>

              <strong>SOCAD'EL AI</strong>
            </div>

          </div>

          <div className="topbar-status">
            <span className="online-dot" />
            <span>AI Assistant</span>
          </div>

          <div className="topbar-user">
            <div className="topbar-avatar">
              {user?.name
                ? user.name.charAt(0).toUpperCase()
                : 'U'}
            </div>
          </div>

        </header>

        {/* CHAT */}
        <section className="chat-area">

          {messages.length === 0 ? (

            <div className="welcome">

              <div className="welcome-icon">
                <Bot size={36} />
                <span className="sparkle-small">
                  <Sparkles size={15} />
                </span>
              </div>

              <div className="welcome-badge">
                <span className="online-dot" />
                SOCAD'EL AI is ready
              </div>

              <h1>
                Bonjour {firstName}
                <span> 👋</span>
              </h1>

              <p className="welcome-description">
                Votre assistant intelligent pour accéder aux
                connaissances, procédures et documents de
                votre organisation.
              </p>

              <div className="suggestions">

                <button
                  onClick={() =>
                    send(
                      'Quelles sont les principales procédures disponibles ?'
                    )
                  }
                >
                  <BookOpen size={19} />

                  <div>
                    <strong>Explorer les procédures</strong>
                    <span>
                      Rechercher dans la base de connaissances
                    </span>
                  </div>

                  <ChevronRight size={17} />
                </button>

                <button
                  onClick={() =>
                    send(
                      'Comment fonctionne cet assistant ?'
                    )
                  }
                >
                  <Sparkles size={19} />

                  <div>
                    <strong>Découvrir SOCAD'EL AI</strong>
                    <span>
                      Comprendre les capacités de l'assistant
                    </span>
                  </div>

                  <ChevronRight size={17} />
                </button>

                <button
                  onClick={() =>
                    send(
                      'Quels documents sont actuellement disponibles ?'
                    )
                  }
                >
                  <FileText size={19} />

                  <div>
                    <strong>Rechercher un document</strong>
                    <span>
                      Consulter les documents disponibles
                    </span>
                  </div>

                  <ChevronRight size={17} />
                </button>

              </div>

            </div>

          ) : (

            <div className="messages">

              {messages.map((m, i) => (

                <div
                  className={`message-row ${m.role}`}
                  key={i}
                >

                  {m.role === 'assistant' && (
                    <div className="message-avatar ai-avatar">
                      <Sparkles size={17} />
                    </div>
                  )}

                  <div className="message-content">

                    <div className="message-label">
                      {m.role === 'assistant'
                        ? 'SOCAD\'EL AI'
                        : 'You'}
                    </div>

                    <div className="message-bubble">
                      {m.content}

                      {m.citations &&
                        m.citations.length > 0 && (

                          <div className="sources">

                            <div className="sources-title">
                              <FileText size={14} />
                              Sources
                            </div>

                            {m.citations.map(
                              (c: any, j: number) => (

                                <div
                                  className="source-item"
                                  key={j}
                                >
                                  <FileText size={13} />
                                  {c.filename}
                                </div>

                              )
                            )}

                          </div>

                        )}

                    </div>

                  </div>

                  {m.role === 'user' && (
                    <div className="message-avatar user-avatar">
                      <User size={16} />
                    </div>
                  )}

                </div>

              ))}

              {busy && (

                <div className="message-row assistant">

                  <div className="message-avatar ai-avatar">
                    <Sparkles size={17} />
                  </div>

                  <div className="message-content">

                    <div className="message-label">
                      SOCAD'EL AI
                    </div>

                    <div className="message-bubble typing">
                      <span />
                      <span />
                      <span />
                    </div>

                  </div>

                </div>

              )}

            </div>

          )}

        </section>

        {/* COMPOSER */}
        <div className="composer-area">

          <div className="composer">

            <button
              className={`composer-button mic-button ${
                recording ? 'recording' : ''
              }`}
              onClick={
                recording ? stopRec : startRec
              }
              title="Voice input"
            >
              <Mic size={19} />
            </button>

            <button
              className="composer-button attachment-button"
              title="Add document"
            >
              <Paperclip size={18} />
            </button>

            <input
              value={input}
              onChange={(e) =>
                setInput(e.target.value)
              }
              onKeyDown={(e) =>
                e.key === 'Enter' && send()
              }
              placeholder={
                recording
                  ? 'Listening...'
                  : 'Ask SOCAD\'EL AI anything...'
              }
              disabled={recording}
            />

            <button
              className="send-button"
              onClick={() => send()}
              disabled={!input.trim() || busy}
            >
              <Send size={18} />
            </button>

          </div>

          <div className="composer-hint">
            SOCAD'EL AI can make mistakes. Verify
            important information before taking action.
          </div>

        </div>

      </main>

    </div>
  );
import './table.css';
import {initAuth,authHeaders} from './auth';

const API=import.meta.env.VITE_API_URL||'';
type Msg={role:'user'|'assistant';content:string;citations?:any[]};
const REQUEST_TIMEOUT_MS=180000;
const PROCESSING_STEPS=['Préparation de votre demande…','Recherche dans les documents…','Analyse du contexte…','Génération de la réponse…'];

function renderContent(content:string){
 const lines=content.split('\n'); const blocks:React.ReactNode[]=[]; let index=0;
 while(index<lines.length){
  if(lines[index].trim().startsWith('|')&&index+1<lines.length&&/^\s*\|?\s*:?-{3,}/.test(lines[index+1])){
   const rows:string[][]=[];
   while(index<lines.length&&lines[index].trim().startsWith('|')){rows.push(lines[index].split('|').slice(1,-1).map(cell=>cell.trim()));index++;}
   blocks.push(<table className="answer-table" key={'table-'+index}><thead><tr>{rows[0].map((cell,j)=><th key={j}>{cell}</th>)}</tr></thead><tbody>{rows.slice(2).map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table>);
  }else{blocks.push(<React.Fragment key={'line-'+index}>{lines[index]}{index<lines.length-1&&<br/>}</React.Fragment>);index++;}
 }
 return blocks;
}
async function readResponse<T>(response:Response):Promise<T>{
 const body=await response.text();
 let data:any;
 try{data=body?JSON.parse(body):null;}catch{throw new Error(`Réponse invalide du serveur (${response.status})`)}
 if(!response.ok)throw new Error(data?.detail||data?.message||`Erreur serveur (${response.status})`);
 if(data===null)throw new Error('Réponse vide du serveur');
 return data as T;
}

async function request(input:RequestInfo|URL,init?:RequestInit){
 const controller=new AbortController(); const timer=window.setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
 try{return await fetch(input,{...init,signal:controller.signal});}
 catch(error:any){if(error?.name==='AbortError')throw new Error('Le modèle met trop de temps à répondre. Vérifiez qu’Ollama est démarré et que le modèle est chargé.'); throw error;}
 finally{window.clearTimeout(timer)}
}

function App(){
 const [messages,setMessages]=useState<Msg[]>([]); const [input,setInput]=useState(''); const [cid,setCid]=useState<string>(); const [busy,setBusy]=useState(false); const [processingStep,setProcessingStep]=useState(0); const [uploading,setUploading]=useState(false); const [recording,setRecording]=useState(false); const [docs,setDocs]=useState<any[]>([]); const [user,setUser]=useState<any>(); const media=useRef<MediaRecorder|null>(null); const chunks=useRef<Blob[]>([]);
 useEffect(()=>{initAuth().then(()=>request(API+'/api/v1/me',{headers:authHeaders()})).then(r=>readResponse<any>(r)).then(setUser).catch(()=>{}); request(API+'/api/v1/documents',{headers:authHeaders()}).then(r=>readResponse<any[]>(r)).then(setDocs).catch(()=>{});},[]);
 async function send(text=input, speak=false){ if(!text.trim()||busy)return; setInput(''); setMessages(m=>[...m,{role:'user',content:text}]); setBusy(true); setProcessingStep(0); try{const r=await request(API+'/api/v1/chat',{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({message:text,conversation_id:cid,use_knowledge:true})}); const d=await readResponse<any>(r); setProcessingStep(PROCESSING_STEPS.length-1); setCid(d.conversation_id); setMessages(m=>[...m,{role:'assistant',content:d.answer,citations:d.citations}]); if(speak){ try{const ar=await request(API+'/api/v1/voice/synthesize',{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({text:d.answer})}); if(ar.ok){const audio=new Audio(URL.createObjectURL(await ar.blob())); await audio.play();}}catch(_e){} }}catch(e:any){setMessages(m=>[...m,{role:'assistant',content:'Erreur: '+e.message}]);}finally{setBusy(false)}}
 useEffect(()=>{if(!busy)return; const timer=window.setInterval(()=>setProcessingStep(step=>Math.min(step+1,PROCESSING_STEPS.length-1)),3500); return()=>window.clearInterval(timer)},[busy]);
 async function startRec(){ const stream=await navigator.mediaDevices.getUserMedia({audio:true}); const rec=new MediaRecorder(stream); media.current=rec; chunks.current=[]; rec.ondataavailable=e=>chunks.current.push(e.data); rec.onstop=async()=>{stream.getTracks().forEach(t=>t.stop()); const blob=new Blob(chunks.current,{type:'audio/webm'}); const fd=new FormData(); fd.append('file',blob,'voice.webm'); setBusy(true); try{const r=await request(API+'/api/v1/voice/transcribe',{method:'POST',headers:authHeaders(),body:fd}); const d=await readResponse<any>(r); if(d.text){setBusy(false); await send(d.text,true);}}catch(e:any){setMessages(m=>[...m,{role:'assistant',content:'Erreur: '+e.message}]);}finally{setBusy(false)}}; rec.start(); setRecording(true); }
 function stopRec(){media.current?.stop(); setRecording(false)}
 async function upload(e:any){const input=e.target;const file=input.files?.[0];input.value='';if(!file||uploading)return;const fd=new FormData();fd.append('file',file);setUploading(true);try{const r=await request(API+'/api/v1/documents',{method:'POST',headers:authHeaders(),body:fd});const d=await readResponse<any>(r);setDocs(x=>[d,...x]);}catch(error:any){alert(error.message)}finally{setUploading(false)}}
 return <div className="app"><aside><div className="brand">Enterprise AI</div><div className="user">{user?.name||'Employee'}<small>{user?.department||'Internal Assistant'}</small></div><label className={'upload '+(uploading?'disabled':'')}>{uploading?'Indexation en cours…':'+ Add knowledge'}<input type="file" hidden disabled={uploading} accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={upload}/></label><h4>Knowledge</h4>{docs.slice(0,10).map(d=><div className="doc" key={d.id}>📄 {d.filename}</div>)}</aside><main><header><div><b>Employee Assistant</b><span>Sovereign · Local AI</span></div><div className="status">● Online</div></header><section className="chat">{messages.length===0&&<div className="welcome"><h1>Bonjour{user?.name?', '+user.name:''} 👋</h1><p>Posez une question sur les procédures, documents ou services de l'entreprise.</p><div className="suggestions"><button onClick={()=>send('Quelles sont les principales procédures disponibles ?')}>Explorer les procédures</button><button onClick={()=>send('Comment fonctionne cet assistant ?')}>Comment fonctionne l’IA ?</button></div></div>}{messages.map((m,i)=><div className={'msg '+m.role} key={i}><div className="bubble">{m.role==='assistant'?renderContent(m.content):m.content}{m.citations?.length>0&&<div className="sources"><b>Sources</b>{m.citations.map((c:any,j:number)=><div key={j}>📄 {c.filename}</div>)}</div>}</div></div>)}{busy&&<div className="msg assistant"><div className="bubble typing"><span className="processing-step">{PROCESSING_STEPS[processingStep]}</span></div></div>}</section><div className="composer"><button className={'mic '+(recording?'recording':'')} onClick={recording?stopRec:startRec}>🎤</button><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder={recording?'Écoute en cours…':'Écrivez votre message…'} disabled={recording}/><button className="send" onClick={()=>send()}>➤</button></div></main></div>
}

createRoot(
  document.getElementById('root')!
).render(
  <App />
);