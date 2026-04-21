/**
 * Nimbus CLI config types
 */

export interface NimbusProfile {
  name: string;
  /** Cloudflare account ID */
  accountId?: string;
  /** Default worker/agent name for this profile */
  agent?: string;
  /** WebSocket base URL (for local or custom) */
  baseUrl?: string;
  /** Active model ref */
  model?: string;
}

export interface NimbusCredentials {
  /** Cloudflare API token */
  cloudflareToken?: string;
  /** OpenAI API key */
  openaiKey?: string;
  /** Anthropic API key */
  anthropicKey?: string;
  /** Google Gemini API key */
  geminiKey?: string;
  /** Groq API key */
  groqKey?: string;
  /** Custom/local API base + key pairs */
  custom?: Record<string, { baseUrl: string; apiKey: string }>;
}

export interface NimbusConfig {
  version: 1;
  /** Currently active profile name */
  activeProfile: string;
  /** All profiles */
  profiles: NimbusProfile[];
}
