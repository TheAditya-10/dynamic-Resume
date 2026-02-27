const DEFAULT_APP_NAME = "resume-portfolio-app"
const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash"
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
const DEFAULT_N8N_TIMEOUT_MS = 120000

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value
    }
  }
  return undefined
}

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

export function getServerConfig() {
  const llmApiKey = firstNonEmpty(process.env.LLM_API_KEY, process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY)
  const llmApiUrl = firstNonEmpty(process.env.LLM_API_URL, process.env.GEMINI_API_URL)
  const llmModel = firstNonEmpty(process.env.LLM_MODEL, process.env.GEMINI_MODEL) ?? DEFAULT_GEMINI_MODEL
  const publicBaseUrl = firstNonEmpty(process.env.PUBLIC_BASE_URL)
  const uploadTokenSecret = firstNonEmpty(process.env.UPLOAD_TOKEN_SECRET, llmApiKey) ?? "local-upload-token-secret"
  const n8nJobMatchWebhookUrl = firstNonEmpty(process.env.N8N_JOB_MATCH_WEBHOOK_URL)
  const n8nWebhookSecret = firstNonEmpty(process.env.N8N_WEBHOOK_SECRET)
  const n8nTimeoutMs = toPositiveInt(process.env.N8N_WEBHOOK_TIMEOUT_MS, DEFAULT_N8N_TIMEOUT_MS)

  return {
    appName: firstNonEmpty(process.env.APP_NAME) ?? DEFAULT_APP_NAME,
    llmApiKey,
    llmApiUrl,
    llmModel,
    publicBaseUrl: publicBaseUrl ? normalizeBaseUrl(publicBaseUrl) : undefined,
    uploadTokenSecret,
    n8nJobMatchWebhookUrl,
    n8nWebhookSecret,
    n8nTimeoutMs,
  }
}

export function buildGeminiUrl(model: string, configuredUrl?: string): string {
  if (!configuredUrl) {
    return `${DEFAULT_GEMINI_BASE_URL}/${model}:generateContent`
  }

  if (configuredUrl.includes("{model}")) {
    return configuredUrl.replace("{model}", model)
  }

  if (configuredUrl.includes(":generateContent")) {
    return configuredUrl
  }

  if (configuredUrl.endsWith("/models")) {
    return `${configuredUrl}/${model}:generateContent`
  }

  return `${configuredUrl.replace(/\/$/, "")}/${model}:generateContent`
}

export function resolvePublicBaseUrl(requestUrl: string): string {
  const configured = getServerConfig().publicBaseUrl
  if (configured) {
    return configured
  }

  const origin = new URL(requestUrl).origin
  return origin.endsWith("/") ? origin.slice(0, -1) : origin
}

export function resolveGeminiBaseUrl(configuredUrl?: string): string | undefined {
  if (!configuredUrl) {
    return undefined
  }

  try {
    return new URL(configuredUrl).origin
  } catch {
    return undefined
  }
}
