# First-Voice.AI Architecture Documentation

## Architecture at a Glance

### System Overview
```mermaid
graph TD
    A[Browser/Client] -->|HTTPS| B[Next.js Frontend]
    B -->|Speech Recognition| C[Web Speech API]
    B -->|TTS| D[ElevenLabs API]
    B -->|API Calls| E[Next.js API Routes]
    E -->|Chat Completions| F[OpenAI GPT-4]
    E -->|Vector Search| G[Milvus Vector DB]
    E -->|Data Storage| H[Supabase]
    B -->|Geolocation| I[Browser Geolocation API]
    E -->|Service Search| J[OpenStreetMap/Nominatim]
    
    subgraph "Vercel Deployment"
        B
        E
    end
    
    subgraph "External Services"
        D
        F
        G
        H
        J
    end
```

### Data Flow & Classification

| Data Type | Classification | Storage Location | Transit Encryption |
|-----------|----------------|------------------|-------------------|
| Voice Audio | **PII** | Browser only (not stored) | N/A (local processing) |
| Conversation Transcripts | **PII** | Supabase (PDF Summary table) | HTTPS/TLS |
| User Location | **PII** | Temporary (browser session) | HTTPS/TLS |
| Generated Summaries | **PII** | Supabase + PDF download | HTTPS/TLS |
| API Keys | **Sensitive** | Environment variables | Encrypted at rest |
| Session State | **Non-PII** | Browser memory | N/A |

## Infrastructure & Runtime

### Hosting & Deployment
- **Primary**: Vercel (serverless functions + static hosting)
- **Database**: Supabase (PostgreSQL)
- **Vector DB**: Milvus (cloud-hosted)
- **CDN**: Vercel Edge Network

### Server Entry Points
```
my-app/app/api/
├── route.js                    # Legacy Milvus vector search endpoint
└── v1/
    ├── query/route.js          # Main conversation handler (stage-based routing)
    ├── doctorRecommendations/route.js  # AI-generated provider recommendations
    ├── searchServices/route.js # Location-based mental health services
    └── resources/route.js      # Mental health resource compilation
```

### API Route Details

#### `/api/v1/query` - Primary Conversation Engine
**Method**: POST  
**Purpose**: Handles all conversation phases through stage-based routing  
**Authentication**: None (anonymous)

**Request Body Parameters:**
| Parameter | Type | Required | Purpose |
|-----------|------|----------|---------|
| `stage` | number | Yes | Determines API behavior: `1` (conversation), `2` (summary), `3` (personal help) |
| `problem_description` | string | Conditional | Initial problem description (stages 1-2) |
| `last_reply` | string | Stage 1 only | User's most recent response |
| `history` | array | Yes | Full conversation history as `{role, content}` objects |
| `questionNumber` | number | Stage 1 only | Current question (1-6) |
| `answerSufficient` | boolean | Stage 1 only | Whether previous answer was adequate |

**Stage-Based Routing:**
```javascript
switch (req_json.stage) {
  case 1: // 6-question structured conversation flow
    // Handles question progression, answer validation, retry logic
    // Returns: {msg, questionNumber, answerSufficient, moveTo?, askForProviders?}
    
  case 2: // Summary generation with vector search
    // Uses Milvus for context + OpenAI for structured summary
    // Returns: {triage, location?, openToHelp?}
    
  case 3: // Dynamic personal help question generation
    // Personalized based on conversation context
    // Returns: {personalHelpQuestion}
}
```

**Response Examples:**
```javascript
// Stage 1 - Continue conversation
{
  "msg": "Thanks for sharing that. When did you first notice feeling this way?",
  "questionNumber": 3,
  "answerSufficient": true
}

// Stage 1 - Trigger summary
{
  "msg": "Thank you for sharing. Let me analyze this information...",
  "questionNumber": 6,
  "moveTo": "summary",
  "askForProviders": true
}

// Stage 2 - Summary response
{
  "triage": "• 1) PRESENTING CONCERNS: [analysis]...",
  "location": "their area",
  "openToHelp": false
}
```

#### `/api/v1/doctorRecommendations` - Personalized Provider Matching
**Method**: POST  
**Purpose**: Generate AI-powered healthcare provider recommendations  
**Model**: OpenAI GPT-4o (higher capability model)

**Request Body:**
```javascript
{
  "summary": "Conversation summary text",
  "userContext": {
    "concerns": ["anxiety", "depression"],
    "symptoms": ["fatigue", "sleep issues"],
    "demographic": {
      "age": 25,
      "gender": "female",
      "location": "Seattle"
    },
    "name": "Sarah"
  }
}
```

**Response:**
```javascript
{
  "finalComments": "Personalized closing message with hope and validation",
  "doctorRecommendations": [
    {
      "providerType": "Licensed Clinical Social Worker (LCSW)",
      "rationale": "Why this provider type fits the user's needs",
      "expectations": "What to expect from this type of care",
      "credentials": "Relevant credentials to look for"
    }
  ]
}
```

#### `/api/v1/searchServices` - Location-Based Service Discovery
**Method**: POST  
**Purpose**: Find mental health services near user's location  
**Integrations**: OpenStreetMap (reverse geocoding), OpenAI (service search)

**Request Body:**
```javascript
{
  "latitude": 47.6062,
  "longitude": -122.3321
}
```

**Process Flow:**
1. **Reverse Geocoding**: Convert coordinates to location name via Nominatim API
2. **Service Search**: Use OpenAI to find mental health services in area
3. **Fallback Logic**: Return mock data if external APIs fail

**Response:**
```javascript
{
  "services": [
    {
      "name": "Community Mental Health Center",
      "phone": "(555) 123-4567", 
      "address": "123 Main St, Seattle, WA",
      "description": "Comprehensive mental health services"
    }
  ],
  "location": "Seattle, King County, Washington, USA",
  "source": "generated_data" // or "web_search", "fallback_data"
}
```

#### `/api/v1/resources` - Mental Health Resource Compilation
**Method**: POST  
**Purpose**: Generate curated mental health resources based on conversation  
**Fallback Strategy**: Returns static resources if OpenAI unavailable

**Request Body:**
```javascript
{
  "history": [
    {"role": "user", "content": "I'm feeling anxious..."},
    {"role": "assistant", "content": "I understand..."}
  ]
}
```

**Processing Logic:**
1. **Context Extraction**: Identify user name, concerns, location from history
2. **Resource Generation**: Use OpenAI to create personalized resource list
3. **Fallback Resources**: Static list if API fails

**Response:**
```javascript
{
  "resources": "• National Mental Health Hotline: 988\n• Crisis Text Line: Text HOME to 741741\n• BetterHelp: Online therapy platform..."
}
```

#### `/api/route.js` - Legacy Milvus Vector Search
**Method**: POST  
**Purpose**: Direct vector database operations (appears unused in current frontend)  
**Status**: Legacy endpoint, superseded by stage-based query API

**Stage-Based Operations:**
```javascript
switch (req_json.stage) {
  case 0: // Simple greeting
    return { msg: "Hello, I'm here to listen and support you. What is your name?" }
    
  case 1: // GPT conversation without vector search
    // Direct OpenAI call with conversation history
    // Returns: {msg} or {questions: [...]}
    
  case 2: // Vector-enhanced summary generation
    // 1. Vectorize user input with text-embedding-ada-002
    // 2. Search Milvus "mental_health_responses" collection
    // 3. Use retrieved context for GPT summary generation
    // Returns: {summary} or structured triage data
}
```

**Vector Search Process:**
1. **Embedding Generation**: Convert user text to 1536-dimension vectors
2. **Similarity Search**: Query Milvus with `limit: 5` for top matches
3. **Context Integration**: Feed retrieved contexts to GPT for enhanced responses

### Build Configuration
- **Framework**: Next.js 15.2.4 (App Router)
- **Build Command**: `next build`
- **Output**: Static + Serverless functions
- **Environment**: Node.js runtime on Vercel

### Environment Variables

| Variable | Purpose | Example | Referenced In |
|----------|---------|---------|---------------|
| `OPENAI_KEY` | OpenAI API access | `sk-...` | `/api/v1/query/route.js:10` |
| `OPENAI_API_KEY` | Alternative OpenAI key | `sk-...` | `/api/v1/resources/route.js:8` |
| `NEXT_PUBLIC_ELEVEN_LABS_API_KEY` | Text-to-speech | `el_...` | `/components/speaker.js:22` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase endpoint | `https://...` | `/lib/supabase.js:3` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public key | `eyJ...` | `/lib/supabase.js:4` |
| `MILVUS_URL` | Vector DB endpoint | `https://...` | `/api/route.js:8` |
| `MILVUS_KEY` | Vector DB auth token | `db_...` | `/api/route.js:9` |

### Supabase Configuration
- **Auth**: Anonymous access (no user registration required)
- **Tables**: 
  - `PDF Summary` - stores conversation summaries and generated PDFs
- **RLS**: Not implemented (relies on anonymous access)
- **Connection**: Client-side via `@supabase/supabase-js`

### External API Integrations

#### OpenAI Integration
- **Models**: `gpt-4o-mini` (primary), `gpt-4o` (doctor recommendations)
- **Usage**: Chat completions, embeddings (`text-embedding-ada-002`)
- **Rate Limiting**: Handled by OpenAI (no client-side limits)
- **Error Handling**: Try-catch with fallback responses

#### ElevenLabs TTS
- **Voice**: Emily (`EXAVITQu4vr4xnSDxMaL`)
- **Model**: `eleven_turbo_v2` (Eleven Flash 2.5)
- **Settings**: Stability 0.7, Similarity boost 0.7
- **Implementation**: `/components/speaker.js:86-129`

#### Web Speech API (STT)
- **Browser Support**: WebKit Speech Recognition
- **Configuration**: Continuous listening, interim results
- **Implementation**: `react-speech-recognition` library
- **Echo Prevention**: AI message detection in `/app/page.js:258-294`

## Codebase Map

```
First-Voice.AI/
├── my-app/                     # Next.js application
│   ├── app/
│   │   ├── api/                # Server-side API routes
│   │   │   ├── route.js        # Vector search (legacy)
│   │   │   └── v1/             # Current API version
│   │   │       ├── query/      # Main conversation handler
│   │   │       ├── doctorRecommendations/  # Provider suggestions
│   │   │       ├── searchServices/         # Location-based services
│   │   │       └── resources/              # Mental health resources
│   │   ├── components/         # React UI components
│   │   │   ├── NavBar.jsx      # Navigation with smooth scroll
│   │   │   ├── Modal.jsx       # Settings modal overlay
│   │   │   ├── Footer.jsx      # Page footer
│   │   │   └── Geolocation.jsx # Location permission handler
│   │   ├── page.js             # Main application (2400 lines)
│   │   ├── layout.js           # Root layout with fonts
│   │   └── globals.css         # Tailwind CSS styles
│   ├── components/             # Shared components
│   │   ├── speaker.js          # ElevenLabs TTS integration
│   │   ├── microphone.js       # Legacy STT component (unused)
│   │   └── Modal.js            # Duplicate modal component
│   ├── lib/
│   │   └── supabase.js         # Supabase client configuration
│   └── package.json            # Dependencies and scripts
├── docs/                       # Documentation (created)
│   └── ARCHITECTURE.md         # This file
└── vercel.json                 # Vercel deployment config
```

### Key Modules

#### Conversation Engine (`/app/page.js`)
- **Primary State Manager**: 40+ useState hooks managing conversation flow
- **Speech Integration**: Web Speech API + ElevenLabs TTS
- **PDF Generation**: Client-side with `pdf-lib`
- **Geolocation**: Browser API integration

#### API Controllers (`/app/api/v1/`)
- **Query Handler**: 6-stage conversation flow with OpenAI
- **Doctor Recommendations**: GPT-4 powered provider matching
- **Service Search**: Location-based mental health service discovery
- **Resource Compilation**: Curated mental health resources

#### UI Components
- **NavBar**: Animated navigation with smooth scrolling
- **Speaker**: TTS playback with queue management
- **Modal**: Settings overlay with backdrop blur
- **Geolocation**: Silent location permission handler

## Conversation Engine & State Handling

### State Machine Pattern

The application implements a **stage-based conversation flow** with detailed sub-states:

```mermaid
stateDiagram-v2
    [*] --> Stage0: App Load
    Stage0 --> Stage1: Start Call
    
    state Stage1 {
        [*] --> Q1: Question 1
        Q1 --> Q2: Answer Sufficient
        Q1 --> Q1: Repeat/Clarify
        Q2 --> Q3: Answer Sufficient
        Q2 --> Q2: Repeat/Clarify
        Q3 --> Q4: Answer Sufficient
        Q3 --> Q3: Repeat/Clarify
        Q4 --> Q5: Answer Sufficient
        Q4 --> Q4: Repeat/Clarify
        Q5 --> Q6: Answer Sufficient
        Q5 --> Q5: Repeat/Clarify
        Q6 --> [*]: Complete
        Q6 --> Q6: Repeat/Clarify
    }
    
    Stage1 --> Stage2: All Questions Complete
    Stage2 --> Stage3: Summary Generated
    Stage3 --> PersonalHelp: Ask for Help
    PersonalHelp --> Completed: Response Received
    Completed --> [*]: End Call
    
    note right of Stage1
        6-question structured flow:
        Q1: Name/Location introduction
        Q2: Current emotional state
        Q3: Timeline/onset identification  
        Q4: Trigger identification
        Q5: Coping strategies exploration
        Q6: Professional help openness
    end note
```

### State Transitions & Guards

#### Stage 1: 6-Question Structured Flow (`/app/api/v1/query/route.js:54-97`)

Each question has a specific prompt and purpose:

**Question 1: Initial Introduction & Onboarding**
- **Purpose**: Collect name and optional location
- **Prompt**: Warm introduction, ask for first name
- **Transition**: Move to Q2 after sufficient response

**Question 2: Exploring Current Emotional State**
- **Purpose**: Understand current feelings and mental state
- **Prompt**: "What's been on your mind lately?"
- **Validation**: Reflect with compassion, avoid judgment

**Question 3: Identifying When It Started**
- **Purpose**: Timeline and onset identification
- **Prompt**: "When did you first notice feeling this way?"
- **Focus**: Gradual vs. event-triggered onset

**Question 4: Understanding Triggers**
- **Purpose**: Identify situational or thought triggers
- **Prompt**: "What situations make these feelings stronger?"
- **Response**: Mirror understanding, maintain compassion

**Question 5: Exploring Coping Strategies**
- **Purpose**: Assess current coping mechanisms
- **Prompt**: "How have you been dealing with these feelings?"
- **Approach**: Highlight strengths and resilience

**Question 6: Forward-Looking Support**
- **Purpose**: Assess openness to professional help
- **Prompt**: "Would you be open to talking to a professional?"
- **Tone**: Hopeful, no pressure, offer continued support

#### Question Flow Logic (`/app/api/v1/query/route.js:109-190`)
```javascript
// State: currentQuestion (1-6), answerSufficient (boolean)
// Transition: Advance if answer sufficient, repeat if not
// Guard: Max 3 repetitions before forced advance

if (isAnswerSufficient && currentQuestion < 6) {
    nextQuestionNumber = currentQuestion + 1;
}

// Force advance after 3 insufficient attempts
if (repeatQuestionCount >= 2 && currentQuestion < 6) {
    setCurrentQuestion(currentQuestion + 1);
    setRepeatQuestionCount(0);
}
```

#### Stage 2: Summary Generation (`/app/api/v1/query/route.js:192-299`)
```javascript
// Trigger: After question 6 completion
// Process: Vector search + GPT summarization
// Output: Structured triage assessment
```

#### Stage 3: Personal Help Question (`/app/api/v1/query/route.js:301-384`)
```javascript
// Dynamic question generation based on conversation context
// Personalized with user name and location if available
```

### Side Effects

1. **TTS Queue Management**: Automatic speech synthesis with echo prevention
2. **PDF Generation**: Client-side summary creation with local resources
3. **Location Services**: Optional geolocation for service recommendations
4. **Supabase Storage**: Conversation summaries stored for reference

## End-to-End Request Pipelines

### Voice Interaction Loop

```mermaid
sequenceDiagram
    participant U as User
    participant B as Browser
    participant API as Next.js API
    participant OpenAI as OpenAI
    participant TTS as ElevenLabs
    
    U->>B: Speaks
    B->>B: Web Speech API transcription
    B->>API: POST /api/v1/query (transcript + context)
    API->>OpenAI: Chat completion request
    OpenAI->>API: AI response
    API->>B: JSON response
    B->>TTS: Text-to-speech request
    TTS->>B: Audio blob
    B->>U: Plays AI response
```

### Storage & Summary Pipeline

```mermaid
sequenceDiagram
    participant API as Query API
    participant OpenAI as OpenAI
    participant Milvus as Vector DB
    participant Supabase as Supabase
    participant Client as Browser
    
    API->>OpenAI: Generate embeddings
    OpenAI->>API: Vector embeddings
    API->>Milvus: Vector similarity search
    Milvus->>API: Relevant context
    API->>OpenAI: Summary generation request
    OpenAI->>API: Structured summary
    API->>Client: Summary response
    Client->>Client: Generate PDF
    Client->>Supabase: Store summary
```

### Error Handling Patterns

#### Timeout Handling
- **Speech Recognition**: 300ms delay after TTS stops
- **Geolocation**: 10-second timeout with fallback
- **API Calls**: Try-catch with user-friendly error messages

#### Partial Failures
- **TTS Unavailable**: Conversation continues without audio
- **Location Denied**: PDF generated without local services
- **OpenAI Errors**: Fallback to generic responses

#### Echo Prevention (`/app/page.js:258-294`)
```javascript
const isLikelyAIEcho = (transcript) => {
    // Compare with recent AI messages
    // Check for 3+ consecutive word matches
    // Ignore if significant overlap detected
};
```

## Security & Privacy

### Authentication Flow
- **Model**: Anonymous access (no user accounts)
- **Session**: Browser-based state management
- **API Security**: Environment variable-based API keys
- **CORS**: Default Next.js CORS handling

### PII Handling
- **Voice Data**: Never leaves browser, processed locally
- **Transcripts**: Temporarily stored, included in PDF summaries
- **Location**: Coordinates only, not stored permanently
- **Conversations**: Stored in Supabase for PDF generation

### Data Minimization
- **No User Profiles**: Anonymous sessions only
- **Minimal Retention**: Data stored only for PDF generation
- **Client-Side Processing**: Audio processing in browser
- **Secure Transmission**: HTTPS for all external communications

### Content Safety
- **Prompt Engineering**: Professional, empathetic responses
- **Crisis Detection**: Identifies suicidal ideation keywords
- **Resource Provision**: Always includes crisis hotlines
- **Professional Boundaries**: Disclaimers about not replacing professional help

### Secrets Management
- **Environment Variables**: Vercel environment configuration
- **Client-Side Keys**: `NEXT_PUBLIC_` prefix for browser access
- **Server-Side Keys**: Secure server environment only
- **No Hardcoded Secrets**: All sensitive data externalized

## Local Development & Production

### Development Setup

```bash
# Clone repository
git clone https://github.com/ronitbatra/First-Voice.AI.git
cd First-Voice.AI/my-app

# Install dependencies
npm install

# Environment setup (create .env.local)
OPENAI_KEY=sk-your-openai-key
NEXT_PUBLIC_ELEVEN_LABS_API_KEY=your-elevenlabs-key
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
MILVUS_URL=your-milvus-endpoint
MILVUS_KEY=your-milvus-token

# Start development server
npm run dev
```

### Environment Template (.env.local.example)
```bash
# OpenAI Configuration
OPENAI_KEY=sk-your-openai-api-key-here
OPENAI_API_KEY=sk-your-openai-api-key-here

# ElevenLabs TTS
NEXT_PUBLIC_ELEVEN_LABS_API_KEY=your-elevenlabs-api-key

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Milvus Vector Database
MILVUS_URL=https://your-milvus-endpoint
MILVUS_KEY=your-milvus-api-key
```

### Testing & Quality Assurance
- **Linting**: ESLint with Next.js configuration
- **Type Safety**: JSDoc comments, no TypeScript
- **Manual Testing**: Browser-based conversation testing
- **No Automated Tests**: Currently no test suite implemented

### Production Deployment

#### Vercel Deployment
```bash
# Build for production
npm run build

# Deploy to Vercel
vercel --prod

# Environment variables set via Vercel dashboard
# Build configuration in vercel.json
```

#### Build Outputs
- **Static Assets**: CSS, images, fonts
- **Serverless Functions**: API routes as Lambda functions
- **Client Bundle**: React application with hydration
- **Service Worker**: None implemented

#### Required Environment Variables (Production)
- All development variables must be configured in Vercel dashboard
- `NEXT_DISABLE_ESLINT=1` set in vercel.json for faster builds

## Interview Cheat Sheet

### Technical Architecture (6 bullets)
- **Full-Stack Next.js**: React frontend with serverless API routes, deployed on Vercel with edge functions
- **AI-Powered Conversations**: OpenAI GPT-4 with 3-stage flow: 6-question assessment → summary generation → personalized help
- **Voice Interface**: Web Speech API for STT + ElevenLabs for natural TTS with echo prevention
- **Vector-Enhanced Context**: Milvus vector database for semantic search of mental health resources  
- **Complex State Management**: 40+ React hooks managing 6-question flow, answer validation, PDF generation, and location services
- **Privacy-First Design**: Anonymous sessions, client-side audio processing, minimal data retention

### Technology Choices & Trade-offs (4 bullets)
- **Why Next.js/React**: Rapid development, serverless scaling, built-in API routes eliminate separate backend
- **Why OpenAI over alternatives**: Superior conversational AI for mental health context, established safety guidelines
- **Why ElevenLabs TTS**: Natural voice quality crucial for mental health conversations, better than browser TTS
- **Trade-off**: Client-side PDF generation increases bundle size but ensures privacy and offline capability

### Privacy & Scaling Considerations (2 bullets)
- **Privacy Posture**: Voice data never leaves browser, anonymous sessions, PII minimization with secure API key management
- **Next Steps**: Add streaming responses, implement retry/backoff patterns, structured logging, and performance monitoring

## Known Gaps & Quick Wins

### High-Priority Improvements

1. **Row Level Security (RLS)**
   - **Gap**: Supabase tables lack access controls
   - **Fix**: Implement RLS policies for PDF Summary table
   - **Impact**: Prevent unauthorized data access

2. **Token Budget Management**
   - **Gap**: No OpenAI token usage tracking or limits
   - **Fix**: Implement conversation length limits and token counting
   - **Impact**: Prevent API cost overruns

3. **Streaming TTS Response**
   - **Gap**: Audio generation blocks conversation flow
   - **Fix**: Implement streaming audio with progressive playback
   - **Impact**: Improved user experience and responsiveness

4. **Retry/Backoff Logic**
   - **Gap**: API failures result in hard errors
   - **Fix**: Exponential backoff for OpenAI, ElevenLabs calls
   - **Impact**: Better reliability and user experience

5. **Structured Logging**
   - **Gap**: Console.log statements throughout codebase
   - **Fix**: Implement structured logging with log levels
   - **Impact**: Better debugging and monitoring

### Medium-Priority Enhancements

6. **Performance Monitoring**
   - **Gap**: No P99 latency or error rate tracking
   - **Fix**: Add Vercel Analytics or custom monitoring
   - **Impact**: Proactive performance optimization

7. **Content Moderation**
   - **Gap**: No explicit content filtering beyond OpenAI defaults
   - **Fix**: Implement additional safety checks for crisis situations
   - **Impact**: Enhanced user safety

8. **Database Migrations**
   - **Gap**: No version control for Supabase schema changes
   - **Fix**: Implement migration scripts and schema versioning
   - **Impact**: Safer database deployments

### Technical Debt

- **Duplicate Components**: Modal.js exists in two locations
- **Legacy API Route**: `/api/route.js` appears unused but contains Milvus logic
- **Mixed API Key Names**: Both `OPENAI_KEY` and `OPENAI_API_KEY` used
- **Large Component**: Main page.js is 2400 lines, needs decomposition
- **Missing TypeScript**: Would improve development experience and reduce runtime errors

---

*Generated through comprehensive codebase analysis on Sunday, September 21, 2025*
