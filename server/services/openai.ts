import OpenAI from 'openai';
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';

export class ClassificationError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export interface AIRequest {
  model: string;
  instructions: string;
  input: string;
  schemaName?: string;
  schema: Record<string, unknown>;
}
export interface AIResponse {
  text: string;
  model: string;
  requestId?: string;
  usage?: { inputTokens: number; outputTokens: number };
}
export type RequestClassification = (request: AIRequest, onInvocation: () => void) => Promise<AIResponse>;

export function classificationModel(): string {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini';
}
export function requireOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new ClassificationError('OPENAI_NOT_CONFIGURED', 'Set OPENAI_API_KEY in the server .env file and restart the backend.');
  return key;
}

// One server-only boundary. Disable SDK retries so every counted invocation is one request.
// Injectable fetch exists for transport tests; routes always use the default OpenAI endpoint.
export function createOpenAIRequest(apiKey: string, fetchImplementation?: typeof fetch): RequestClassification {
  const client = new OpenAI({ apiKey, timeout: 45_000, maxRetries: 0, fetch: fetchImplementation });
  return async (request, onInvocation) => {
    const params: ResponseCreateParamsNonStreaming = {
      model: request.model,
      instructions: request.instructions,
      input: request.input,
      store: false,
      max_output_tokens: 3000,
      text: { format: { type: 'json_schema', name: request.schemaName || 'lead_classification', strict: true, schema: request.schema } },
    };
    try {
      onInvocation();
      const response = await client.responses.create(params);
      if (response.status !== 'completed') {
        throw new ClassificationError('OPENAI_INCOMPLETE', 'OpenAI did not complete the agent response.');
      }
      const refused = response.output.some(item => item.type === 'message' && item.content.some(part => part.type === 'refusal'));
      if (refused) throw new ClassificationError('OPENAI_REFUSAL', 'OpenAI declined to process this record.');
      // output_text includes final answer text only. Never store raw responses or reasoning items.
      if (!response.output_text) throw new ClassificationError('OPENAI_EMPTY', 'OpenAI returned no agent output.');
      return {
        text: response.output_text, model: response.model, requestId: response._request_id || undefined,
        usage: response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : undefined,
      };
    } catch (error) {
      if (error instanceof ClassificationError) throw error;
      if (error instanceof OpenAI.APIConnectionTimeoutError) throw new ClassificationError('OPENAI_TIMEOUT', 'AI request timed out. Please try a new run.');
      if (error instanceof OpenAI.APIError) {
        if (error.status === 401 || error.status === 403) throw new ClassificationError('OPENAI_ACCESS', 'OpenAI access was denied. Check the server API key and project permissions.');
        if (error.status === 429) throw new ClassificationError('OPENAI_RATE_LIMIT', 'OpenAI rate or quota limit reached. Check API billing and limits.');
        throw new ClassificationError('OPENAI_REQUEST_FAILED', 'OpenAI could not process the agent request. Check server model configuration and service availability.');
      }
      throw new ClassificationError('OPENAI_CONNECTION', 'Unable to reach OpenAI.');
    }
  };
}
