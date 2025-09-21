# Environment Variables Reference

## Overview

First-Voice.AI uses environment variables to manage API keys, database connections, and service configurations. Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser client, while others remain server-side only.

## Required Variables

### OpenAI Configuration

#### `OPENAI_KEY`
- **Purpose**: Primary OpenAI API key for GPT-4 chat completions
- **Type**: Server-side only
- **Format**: `sk-...` (starts with sk-)
- **Used In**: 
  - `/app/api/v1/query/route.js:10`
  - `/app/api/v1/doctorRecommendations/route.js:8`
  - `/app/api/route.js:13`
- **Example**: `sk-proj-1234567890abcdef...`

#### `OPENAI_API_KEY` 
- **Purpose**: Alternative OpenAI key (fallback)
- **Type**: Server-side only
- **Format**: `sk-...` (starts with sk-)
- **Used In**: 
  - `/app/api/v1/resources/route.js:8`
  - `/app/api/v1/searchServices/route.js:6`
- **Example**: `sk-proj-abcdef1234567890...`

### Text-to-Speech Configuration

#### `NEXT_PUBLIC_ELEVEN_LABS_API_KEY`
- **Purpose**: ElevenLabs API access for text-to-speech conversion
- **Type**: Client-side (exposed to browser)
- **Format**: Alphanumeric string
- **Used In**: `/components/speaker.js:22`
- **Voice**: Emily (`EXAVITQu4vr4xnSDxMaL`)
- **Model**: `eleven_turbo_v2`
- **Example**: `el_1234567890abcdef...`

### Database Configuration

#### `NEXT_PUBLIC_SUPABASE_URL`
- **Purpose**: Supabase project endpoint URL
- **Type**: Client-side (exposed to browser)
- **Format**: HTTPS URL
- **Used In**: `/lib/supabase.js:3`
- **Example**: `https://xyzproject.supabase.co`

#### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Purpose**: Supabase anonymous access key (public key)
- **Type**: Client-side (exposed to browser)
- **Format**: JWT token (starts with eyJ)
- **Used In**: `/lib/supabase.js:4`
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Vector Database Configuration

#### `MILVUS_URL`
- **Purpose**: Milvus vector database endpoint
- **Type**: Server-side only
- **Format**: HTTPS URL
- **Used In**: `/app/api/route.js:8`
- **Example**: `https://in03-abc123.api.gcp-us-west1.zillizcloud.com`

#### `MILVUS_KEY`
- **Purpose**: Milvus authentication token
- **Type**: Server-side only
- **Format**: Alphanumeric token
- **Used In**: `/app/api/route.js:9`
- **Example**: `db_123456:abcdef123456789...`

## Development Setup

### Local Development (.env.local)

Create a `.env.local` file in the `my-app/` directory:

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

### Production Setup (Vercel)

Set environment variables in the Vercel dashboard:

1. Navigate to your project settings
2. Go to Environment Variables section
3. Add all variables listed above
4. Ensure production values are used

### Build-Time Variables

#### `NEXT_DISABLE_ESLINT`
- **Purpose**: Disable ESLint during Vercel builds for faster deployment
- **Type**: Build-time only
- **Value**: `"1"`
- **Set In**: `vercel.json`

## Security Considerations

### Client-Side Variables
- Variables prefixed with `NEXT_PUBLIC_` are **exposed to the browser**
- Do not use for sensitive server-side operations
- Suitable for public API keys and configuration

### Server-Side Variables
- Remain secure on the server
- Never exposed to client-side code
- Used for sensitive API operations

### API Key Management
- Store all keys securely in environment variables
- Never commit keys to version control
- Rotate keys regularly
- Use different keys for development/production

## Validation & Testing

### Environment Validation

The application includes basic environment validation:

```javascript
// Speaker component validates ElevenLabs key
if (!ELEVEN_LABS_API_KEY) {
  console.error("Eleven Labs API key is not provided");
  return null;
}

// Resources API validates OpenAI key
if (!openai || !process.env.OPENAI_API_KEY) {
  console.error("OpenAI not initialized or API key missing");
  return fallbackResponse;
}
```

### Testing Configuration

To test environment setup:

1. Start development server: `npm run dev`
2. Check browser console for API key validation errors
3. Test voice functionality to verify ElevenLabs integration
4. Verify conversation flow to confirm OpenAI connectivity

## Troubleshooting

### Common Issues

#### "OpenAI API key missing" Error
- Verify `OPENAI_KEY` is set correctly
- Check for typos in variable name
- Ensure key starts with `sk-`

#### "Eleven Labs API key is not provided" Error
- Verify `NEXT_PUBLIC_ELEVEN_LABS_API_KEY` is set
- Remember the `NEXT_PUBLIC_` prefix is required
- Restart development server after adding

#### Supabase Connection Issues
- Verify both URL and anonymous key are set
- Check URL format (should include `.supabase.co`)
- Ensure anonymous key is valid JWT format

#### Milvus Vector Search Failures
- Verify `MILVUS_URL` and `MILVUS_KEY` are correct
- Check network connectivity to Milvus endpoint
- Validate token format and permissions

### Debug Commands

```bash
# Check environment variables (development)
npm run dev -- --debug

# Verify Next.js can read environment variables
node -e "console.log(process.env.OPENAI_KEY ? 'OPENAI_KEY set' : 'OPENAI_KEY missing')"

# Test Supabase connection
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL || 'Supabase URL missing')"
```

---

*Last Updated: September 21, 2025*
