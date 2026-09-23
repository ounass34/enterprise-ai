import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
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
createRoot(document.getElementById('root')!).render(<App/>);
