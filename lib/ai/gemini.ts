import { GEMINI_TOOL_DECLARATIONS } from './tools'

export interface ChatHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

interface GeminiPart {
  text?: string
  thoughtSignature?: string
  functionCall?: { name: string; args?: Record<string, unknown> }
  functionResponse?: { name: string; response: { result: unknown } }
}

interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

export interface ToolExecutor {
  (name: string, args: Record<string, unknown>): Promise<unknown>
}

export interface ExecutedToolCall {
  name: string
  args: Record<string, unknown>
  result: unknown
}

// gemini-flash-latest alias persistently returns 503; pinned dated model per Google guidance.
const MODEL = 'gemini-3.6-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
const MAX_STEPS = 5
const MAX_ATTEMPTS = 3
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callGemini(apiKey: string, body: unknown): Promise<Response> {
  let lastRes: Response | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      lastRes = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
      })
    } catch (err) {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(1000 * 2 ** (attempt - 1))
        continue
      }
      throw err
    }
    if (lastRes.ok || !RETRYABLE_STATUS.has(lastRes.status)) {
      return lastRes
    }
    if (attempt < MAX_ATTEMPTS) {
      await sleep(1000 * 2 ** (attempt - 1))
    }
  }
  return lastRes as Response
}

export async function runGeminiWithTools(options: {
  systemPrompt: string
  message: string
  history: ChatHistoryItem[]
  onToolCall: ToolExecutor
}): Promise<{ reply: string; toolCalls: ExecutedToolCall[] }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Assistant unavailable. Missing server key.')
  }

  const contents: GeminiContent[] = [
    ...options.history.map((h): GeminiContent => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    })),
    { role: 'user', parts: [{ text: options.message }] },
  ]

  let reply = ''
  const toolCalls: ExecutedToolCall[] = []

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const res = await callGemini(apiKey, {
      system_instruction: { parts: [{ text: options.systemPrompt }] },
      contents,
      tools: [{ function_declarations: GEMINI_TOOL_DECLARATIONS }],
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('Gemini request failed:', res.status, detail.slice(0, 500))
      if (RETRYABLE_STATUS.has(res.status)) {
        throw new Error(`Assistant busy (${res.status}). Please retry.`)
      }
      throw new Error(`Assistant request failed: ${res.status} ${detail.slice(0, 200)}`.trim())
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: GeminiPart[] } }[]
    }
    const parts = json.candidates?.[0]?.content?.parts ?? []
    const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!)

    const textParts = parts
      .filter((p) => typeof p.text === 'string' && p.text.length > 0)
      .map((p) => p.text as string)
    if (textParts.length > 0) {
      reply = reply ? `${reply}\n${textParts.join('\n')}` : textParts.join('\n')
    }

    if (calls.length === 0) {
      break
    }

    // Echo the model turn back verbatim so thoughtSignature fields survive.
    // Rebuilding functionCall parts drops them and the API rejects the call.
    contents.push({ role: 'model', parts })

    const fnResponses: GeminiPart[] = []
    for (const call of calls) {
      const args = call.args ?? {}
      const result = await options.onToolCall(call.name, args)
      toolCalls.push({ name: call.name, args, result })
      fnResponses.push({
        functionResponse: { name: call.name, response: { result } },
      })
    }
    // Function responses must reuse the user role on current Gemini models.
    contents.push({ role: 'user', parts: fnResponses })
  }

  return { reply: reply || 'Done.', toolCalls }
}
