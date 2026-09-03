import Groq from 'groq-sdk';

export function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY || 'dummy_groq_key';
  return new Groq({ apiKey });
}

export const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
