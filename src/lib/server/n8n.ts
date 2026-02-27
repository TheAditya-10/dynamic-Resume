import { getServerConfig } from "@/lib/server/config"
import { normalizeJobMatchResult, type JobMatchResult } from "@/lib/server/job-match"

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

function summarizeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return "Unknown error"
}

function safeSnippet(value: unknown, maxLength = 2000): string {
  try {
    const text = JSON.stringify(value)
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
  } catch {
    return "[unserializable payload]"
  }
}

function hasJobMatchShape(value: unknown): boolean {
  const object = asObject(value)
  return object.originalScore !== undefined || object.improvedResume !== undefined
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function unwrapN8nPayload(input: unknown, depth = 0): unknown {
  if (depth > 6) {
    return input
  }

  if (typeof input === "string") {
    const parsed = tryParseJson(input)
    if (parsed === input) {
      return input
    }
    return unwrapN8nPayload(parsed, depth + 1)
  }

  if (Array.isArray(input)) {
    return unwrapN8nPayload(input[0] ?? {}, depth + 1)
  }

  const root = asObject(input)
  if (Object.keys(root).length === 0) {
    return input
  }

  if (hasJobMatchShape(root)) {
    return root
  }

  const response = asObject(root.response)
  if (Object.keys(response).length > 0) {
    if (hasJobMatchShape(response)) return response
    if (response.output !== undefined) return unwrapN8nPayload(response.output, depth + 1)
    if (response.result !== undefined) return unwrapN8nPayload(response.result, depth + 1)
    if (response.data !== undefined) return unwrapN8nPayload(response.data, depth + 1)
    if (response.body !== undefined) return unwrapN8nPayload(response.body, depth + 1)
  }

  if (root.body !== undefined) return unwrapN8nPayload(root.body, depth + 1)
  if (root.data !== undefined) return unwrapN8nPayload(root.data, depth + 1)
  if (root.result !== undefined) return unwrapN8nPayload(root.result, depth + 1)
  if (root.output !== undefined) return unwrapN8nPayload(root.output, depth + 1)
  if (root.json !== undefined) return unwrapN8nPayload(root.json, depth + 1)

  return root
}

async function postJsonToWebhook(url: string, payload: Record<string, unknown>): Promise<unknown> {
  const config = getServerConfig()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.n8nTimeoutMs)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.n8nWebhookSecret ? { "x-workflow-secret": config.n8nWebhookSecret } : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`n8n webhook failed with status ${response.status}: ${detail}`)
    }

    const text = await response.text()
    if (!text.trim()) {
      throw new Error("n8n webhook returned an empty body.")
    }

    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new Error("n8n webhook returned non-JSON response.")
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function tryEvaluateJobMatchWithN8n(input: {
  resumeData: Record<string, unknown>
  jobDescription: string
}): Promise<JobMatchResult | null> {
  const config = getServerConfig()
  if (!config.n8nJobMatchWebhookUrl) {
    return null
  }

  try {
    const raw = await postJsonToWebhook(config.n8nJobMatchWebhookUrl, {
      resumeData: input.resumeData,
      jobDescription: input.jobDescription,
      source: "job-match-api",
    })
    const normalized = unwrapN8nPayload(raw)
    try {
      return normalizeJobMatchResult(normalized, input.resumeData)
    } catch (error) {
      console.warn("job-match-n8n-invalid-payload", safeSnippet(normalized))
      throw error
    }
  } catch (error) {
    console.warn("job-match-n8n-fallback", summarizeError(error))
    return null
  }
}
