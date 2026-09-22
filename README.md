# enterprise-ai
Assistant employé souverain, multimodal texte + voix, RAG documentaire, mémoire utilisateur, authentification/RBAC, et quelques outils internes — sans aucune API IA externe.
Architecture V1 réévaluée
                         EMPLOYÉ
                            │
                 ┌──────────┴──────────┐
                 │                     │
              Web/PWA              Mobile
                 │                     │
                 └──────────┬──────────┘
                            │
                         HTTPS
                            │
                    ┌───────▼───────┐
                    │    Gateway    │
                    │    FastAPI    │
                    └───────┬───────┘
                            │
              ┌─────────────┼──────────────┐
              │             │              │
              ▼             ▼              ▼
           Auth/RBAC       Chat        Voice Service
           Keycloak       Service          │
              │             │          ┌───┴────┐
              │             │          │        │
              │             │         STT      TTS
              │             │          │        │
              │             │          └───┬────┘
              │             │              │
              └─────────────┼──────────────┘
                            │
                     ┌──────▼──────┐
                     │ AI Gateway  │
                     │ Model Router│
                     └──────┬──────┘
                            │
                         vLLM
                            │
                         Qwen3
                            │
                ┌───────────┴───────────┐
                │                       │
              RAG                    Memory
                │                       │
             Qdrant                 PostgreSQL
                │
             Documents
                │
               MinIO
1. Ce que je supprimerais de la V1

Je reporterais :

Kubernetes
cluster Qdrant
multi-GPU
multi-agent complexe
orchestration lourde
fine-tuning
SAP write actions
workflows autonomes
haute disponibilité complète
235B

Tout cela pourra venir ensuite.

Pour la première version, la priorité doit être l'expérience employé.

2. Le vrai cœur de la V1

Je définirais 6 capacités.

1. Conversation texte
Employé
   ↓
Question
   ↓
RAG + contexte utilisateur
   ↓
Qwen
   ↓
Réponse + sources
2. Conversation vocale
Employé parle
      ↓
Micro
      ↓
WebRTC / WebSocket
      ↓
STT local
      ↓
LLM
      ↓
TTS local
      ↓
Audio
      ↓
Employé

L'objectif est que l'utilisateur puisse simplement :

« Bonjour, peux-tu m'expliquer la procédure pour demander un congé ? »

et obtenir une réponse vocale.

3. Voice : attention à ne pas confondre deux architectures

Il y a deux façons de faire.

Mode A — Push-to-talk
🎤 Maintenir le bouton
        ↓
     parler
        ↓
    arrêter
        ↓
    STT → LLM → TTS

C'est ce que je recommande pour V1.

C'est beaucoup plus simple et suffisamment naturel.

Mode B — conversation temps réel
🎤 microphone
      ↓
stream audio
      ↓
VAD
      ↓
stream STT
      ↓
LLM streaming
      ↓
TTS streaming
      ↓
🔊 haut-parleur

C'est la V2.

Elle donne une expérience proche d'un assistant téléphonique, mais elle nécessite davantage de travail sur le streaming, les interruptions, la latence et la gestion de sessions.

4. STT local

Pour le speech-to-text, je choisirais Whisper/faster-whisper dans la première version.

La chaîne :

Audio
 ↓
VAD
 ↓
Whisper
 ↓
texte

Pour le français, l'anglais et les conversations professionnelles, c'est une base très solide.

Et surtout :

❌ Google Speech
❌ Azure Speech
❌ OpenAI Whisper API
❌ AWS Transcribe

✓ Whisper local
5. TTS local

Pour la synthèse vocale, je prévoirais une couche abstraite :

TTSProvider
    │
    ├── Piper
    ├── Kokoro
    └── Future TTS

Cela permet de changer le moteur sans modifier l'application.

Pour V1, un moteur TTS léger comme Piper ou un modèle plus qualitatif comme Kokoro peut être évalué.

Le principe reste :

LLM
 ↓
text
 ↓
TTS
 ↓
wav/opus
 ↓
browser
6. GPU : la situation change

Avec un assistant vocal, tu dois faire tourner simultanément :

LLM
STT
TTS
Embedding
Reranker

Mais cela ne signifie toujours pas qu'il faut 2 × 48 GB.

Pour une première version avec quelques utilisateurs simultanés, je viserais :

Serveur unique V1
CPU        16–24 cores
RAM        128 GB
GPU        1 × 48 GB VRAM
NVMe       2–4 TB
Network    1/10 GbE

C'est maintenant mon choix préféré pour ton V1.

7. Pourquoi 48 GB plutôt que 24 GB ?

Parce que tu veux conserver de la marge.

Avec 48 GB :

GPU
│
├── Qwen3 30B-A3B quantifié
├── ou Qwen3 14B/8B
├── embeddings
├── reranker
└── éventuellement TTS/STT

Mais je ne ferais pas nécessairement tourner tout simultanément sur le GPU.

Par exemple :

GPU
 │
 └── Qwen3
       │
       └── LLM principal

CPU
 ├── Whisper
 ├── VAD
 ├── Piper/Kokoro
 └── RAG

Cela permet d'économiser énormément de VRAM.

8. Configuration encore moins chère

Pour un véritable POC :

CPU        16 cores
RAM        64 GB
GPU        24 GB
NVMe       2 TB

avec :

Qwen3 8B
+
Whisper small/medium
+
Piper
+
Qdrant
+
PostgreSQL

Ça suffit largement pour démontrer le produit.

9. Je ferais donc deux machines logiques, mais une seule physique

Au niveau logiciel :

              SERVER
                 │
      ┌──────────┴──────────┐
      │                     │
   CPU SERVICES          GPU SERVICES
      │                     │
 ┌────┼─────┐          ┌────┴─────┐
 │    │     │          │          │
RAG  STT   TTS        LLM      Embedding
 │
Postgres
Qdrant
MinIO
Redis
Keycloak

Pas besoin de plusieurs serveurs au début.

10. Infrastructure V1 que je recommande
Serveur
Ressource	V1
CPU	16–24 cores
RAM	128 GB
GPU	1 × 48 GB
NVMe système	1 TB
NVMe données	2–4 TB
Réseau	10 GbE
OS	Ubuntu Server 24.04 LTS
Containers	Docker Compose
Services
Traefik
FastAPI Gateway
AI Core
Voice Service
RAG Service
Worker
PostgreSQL
Qdrant
Redis
MinIO
Keycloak
vLLM
Web UI

12 services, mais sur une seule machine.

11. Dimensionnement utilisateurs

Je prendrais comme cible initiale :

100–300 employés enregistrés
50–100 utilisateurs actifs/jour
5–10 conversations simultanées
2–4 conversations vocales simultanées

Ce dernier chiffre est important.

La voix est beaucoup plus exigeante qu'un simple chat parce qu'elle implique :

audio input
+
STT
+
LLM
+
TTS
+
streaming

Mais pour un usage interne où tout le monde ne parle pas simultanément à l'IA, une seule GPU 48 GB est une base raisonnable.

12. Architecture repository V1 simplifiée

Je réduirais aussi le repository.

enterprise-ai/
│
├── apps/
│   └── employee-assistant/
│       ├── web/
│       └── mobile/
│
├── services/
│   │
│   ├── gateway/
│   │
│   ├── assistant/
│   │   ├── chat/
│   │   ├── memory/
│   │   ├── prompts/
│   │   └── router/
│   │
│   ├── voice/
│   │   ├── stt/
│   │   ├── tts/
│   │   ├── vad/
│   │   └── streaming/
│   │
│   ├── rag/
│   │   ├── ingestion/
│   │   ├── embeddings/
│   │   ├── retrieval/
│   │   └── reranking/
│   │
│   ├── workers/
│   │
│   └── connectors/
│       ├── documents/
│       ├── rest/
│       └── sap/
│
├── models/
│   ├── llm/
│   ├── stt/
│   ├── tts/
│   ├── embeddings/
│   └── reranker/
│
├── data/
│
├── db/
│   └── migrations/
│
├── infrastructure/
│   ├── docker/
│   └── kubernetes/
│
├── monitoring/
│
├── security/
│
├── tests/
│   ├── ai/
│   ├── rag/
│   ├── voice/
│   └── security/
│
└── docs/

C'est beaucoup plus adapté à une V1.

13. Assistant employé

Je lui donnerais quatre modes :

┌─────────────────────────────────────────┐
│           ENTERPRISE ASSISTANT          │
├─────────────────────────────────────────┤
│                                         │
│  💬 Chat       🎤 Voice                 │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Bonjour Oussoumanou, comment      │  │
│  │ puis-je vous aider ?              │  │
│  └───────────────────────────────────┘  │
│                                         │
│  📚 Knowledge                           │
│  📄 Documents                           │
│  🔎 Search                              │
│  ⚙️ Actions autorisées                 │
│                                         │
└─────────────────────────────────────────┘
14. Les connaissances

Pour commencer :

Knowledge Base
│
├── RH
│   ├── règlement intérieur
│   ├── congés
│   ├── absences
│   ├── avantages
│   └── procédures
│
├── IT
│   ├── procédures
│   ├── sécurité
│   ├── support
│   └── applications
│
├── Finance
│
├── HSE
│
├── Achats
│
└── Général

Et chaque document possède :

department
classification
author
version
valid_from
valid_to

Cela permet à l'IA de ne pas répondre à partir d'une ancienne procédure.

15. Personnalisation employé

Chaque employé possède un contexte :

{
  "employee_id": "...",
  "department": "IT",
  "role": "SAP Service Manager",
  "language": "fr",
  "permissions": [
    "it.read",
    "sap.read"
  ]
}

Le système peut alors adapter la réponse :

« Selon la procédure applicable à votre département… »

Mais sans donner accès aux données auxquelles l'employé n'a pas droit.

16. Mémoire

Je séparerais :

Mémoire conversationnelle
Conversation
 ↓
PostgreSQL
Mémoire sémantique
Important facts
 ↓
Embedding
 ↓
Qdrant

Mais je ne laisserais pas le LLM décider seul de ce qu'il mémorise.

Il faut une politique :

memory_policy

avec :

temporary
session
user_preference
business_context
forbidden
17. Conversation vocale

Pour V1 :

           🎤
           │
           ▼
       Browser
           │
       WebSocket
           │
           ▼
        Voice API
           │
      ┌────┴────┐
      ▼         ▼
     VAD       STT
                │
                ▼
             Assistant
                │
              Qwen
                │
                ▼
               TTS
                │
                ▼
             Browser
                │
                🔊
Objectif de latence

Je viserais :

VAD                  < 100 ms
STT                  < 1–2 s
LLM first token      < 1–2 s
TTS first audio      < 500 ms

Ce sont des objectifs, pas des garanties ; ils devront être mesurés avec le matériel et les modèles choisis.

18. Le point très important : streaming

Pour que la voix paraisse naturelle, il ne faut pas faire :

STT
 ↓
attendre toute la réponse LLM
 ↓
TTS
 ↓
attendre tout l'audio
 ↓
jouer

Mais :

STT
 ↓
LLM streaming
 ↓
phrases/chunks
 ↓
TTS streaming
 ↓
audio streaming

Ainsi l'utilisateur commence à entendre la réponse alors que le LLM est encore en train de générer.

19. Push-to-talk d'abord

Je recommande fortement :

V1.0
🎤 Appuyer
     ↓
Parler
     ↓
Relâcher
     ↓
Réponse
V1.5
🎤 Voice mode
     ↓
VAD
     ↓
détection automatique de fin de parole
V2
Conversation temps réel
     ↓
interruptions
     ↓
barge-in
     ↓
conversation naturelle

Cela évite de transformer le premier produit en projet de téléphonie IA.

20. Ce que je changerais aussi dans le choix du modèle

Pour l'assistant employé, je ne choisirais pas systématiquement le plus gros modèle.

Je ferais :

                  ROUTER
                     │
          ┌──────────┼──────────┐
          │          │          │
          ▼          ▼          ▼
       Simple     Knowledge   Complex
          │          │          │
        8B         14B        30B-A3B

Par exemple :

« Quelle est la procédure de congé ? »

→ petit modèle + RAG.

Mais :

« Compare ces deux procédures et explique les changements qui impactent mon département. »

→ modèle plus important.

Cela réduit fortement la consommation GPU.

21. Infrastructure cible V1

Je la résumerais donc ainsi :

                    ┌────────────────────────┐
                    │       SERVER V1        │
                    │                        │
                    │  16–24 CPU             │
                    │  128 GB RAM            │
                    │  1 × 48 GB GPU         │
                    │  3–4 TB NVMe           │
                    │  10 GbE                │
                    └───────────┬────────────┘
                                │
         ┌──────────────────────┼─────────────────────┐
         │                      │                     │
         ▼                      ▼                     ▼
   APPLICATIONS              AI/GPU                 DATA
         │                      │                     │
    FastAPI                vLLM/Qwen              PostgreSQL
    Web                     STT                    Qdrant
    Keycloak                TTS                    Redis
    Gateway                 Embedding              MinIO
         │
         └──────────────────────┬─────────────────────┘
                                │
                            BACKUP NAS
                            8–12 TB+
22. Et pour la haute disponibilité plus tard

Lorsque l'adoption devient importante :

                 LOAD BALANCER
                       │
              ┌────────┴────────┐
              ▼                 ▼
          APP NODE 1        APP NODE 2
              │                 │
              └────────┬────────┘
                       │
                ┌──────▼──────┐
                │ AI CLUSTER  │
                │             │
                │ GPU 1       │
                │ GPU 2       │
                │ GPU 3       │
                └──────┬──────┘
                       │
              ┌────────┼─────────┐
              ▼        ▼         ▼
           PG HA    Qdrant HA  MinIO HA

À ce stade seulement, Kubernetes commence à devenir réellement intéressant.

23. Mon estimation finale

Pour la V1 assistant employé texte + voix, je recommande :

Minimum POC

24 GB GPU / 64 GB RAM / 2 TB NVMe

V1 entreprise que je choisirais

48 GB GPU / 128 GB RAM / 3–4 TB NVMe / 16–24 cores

V2 croissance

2 × 48 GB GPU / 256 GB RAM / 6–8 TB NVMe

AI Factory

4–8 × 80 GB GPU / 512 GB–1 TB RAM

Donc par rapport à mon dimensionnement précédent, je réduis clairement la première infrastructure à un seul serveur GPU de 48 GB + un système de backup séparé.

C'est beaucoup plus cohérent pour valider d'abord l'adoption de l'assistant.

Et je ferais une décision architecturale supplémentaire

Je donnerais au produit un nom de couche générique, par exemple :

Enterprise AI Core
        │
        └── Employee Assistant

et non :

Employee Assistant

comme nom de toute la plateforme.

Parce que dans 6–12 mois, tu pourras ajouter :

Enterprise AI Core
│
├── Employee Assistant
├── SAP Copilot
├── IT Service Assistant
├── HR Assistant
├── Legal Assistant
├── Fraud Intelligence
├── Document Intelligence
└── Voice Assistant

Le même moteur, le même RAG, le même IAM, les mêmes modèles locaux et les mêmes outils.

C'est cette approche qui permet de commencer avec un seul serveur relativement raisonnable tout en conservant une trajectoire vers une véritable plateforme IA d'entreprise souveraine.
