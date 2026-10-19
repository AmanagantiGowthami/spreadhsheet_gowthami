// ─────────────────────────────────────────────────────────────
//  LLM provider abstraction.
//
//  The app never talks to a model directly — it talks to a
//  `provider`. A provider is any object with:
//
//      complete({ system, user, history }) => Promise<{ text, provider }>
//
//  `text` is the raw model output. You are expected to extract and
//  validate JSON from it yourself: models wrap JSON in prose, in code
//  fences, or return something that is not JSON at all.
//
//  Two providers ship with the repo:
//    • mock  — deterministic, offline, answers the prompts listed in
//              fixtures/ai-eval/*.json. Used by graders. The default.
//    • http  — YOURS. Call any LLM API you like (Anthropic, OpenAI,
//              Gemini, Ollama, …) with plain fetch(). Read the endpoint,
//              key and model from the VITE_AI_* env vars (.env.example).
//
//  Do not hard-code a vendor anywhere else: everything outside this
//  file must behave identically with either provider.
// ─────────────────────────────────────────────────────────────
import { createMockProvider } from './mockProvider.js'

/**
 * @typedef {{ role: 'user' | 'assistant', content: string }} ChatTurn
 * @typedef {{ system: string, user: string, history?: ChatTurn[] }} CompletionRequest
 * @typedef {{ text: string, provider: string }} CompletionResponse
 * @typedef {{ name: string, complete: (req: CompletionRequest) => Promise<CompletionResponse> }} Provider
 */

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}

/** @returns {Provider} */
export function createHttpProvider(config = {}) {
    const endpoint = config.endpoint ?? env.VITE_AI_ENDPOINT
    const apiKey = config.apiKey ?? env.VITE_AI_API_KEY
    const model = config.model ?? env.VITE_AI_MODEL

    return {
        name: 'http',
        async complete(request) {
            // TODO (candidate): call the LLM API of your choice with fetch().
            //   - send request.system as the system prompt, request.history then
            //     request.user as the conversation turns
            //   - return { text: <model text>, provider: 'http' }
            //   - surface network / auth / rate-limit failures as thrown Errors
            //     with a readable message; the UI must show them, never swallow them
            void endpoint; void apiKey; void model; void request
            throw new Error('createHttpProvider is not implemented yet — wire it to the API of your choice (src/ai/provider.js)')
        },
    }
}

/**
 * Pick a provider from VITE_AI_PROVIDER. Unknown values fall back to mock
 * so the app always boots.
 * @returns {Provider}
 */
export function createProvider(kind = env.VITE_AI_PROVIDER || 'mock') {
    if (kind === 'http') return createHttpProvider()
    return createMockProvider()
}
