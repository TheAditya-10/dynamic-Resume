# n8n Import Guide (Job Match + Resume Enhancement)

This workflow is based on your linear reference flow and keeps compatibility with your app.
It uses `@n8n/n8n-nodes-langchain` agent/tool/model nodes.

## Flow Summary
1. `Webhook Job Match1`
2. `Call 'Resume Guidelines'` (mandatory)
3. `Normalize Request` (maps app payload to agent fields)
4. `Resume & Cover Letter AI Agent`
5. Agent tools: `Resume Evaluator` -> `Resume Rewriter` -> `Resume Evaluator`
6. `Structured Output Parser` enforces app response shape

## Import Workflow
1. Open n8n.
2. Go to `Workflows` -> `Import from File`.
3. Select `docs/n8n/job-match-enhancement-workflow.json`.
4. Save workflow.

## Required Node Mapping After Import
1. In `Call Resume Guidelines`, re-select your Resume Guidelines workflow.
2. In `Resume Evaluator`, re-select your Resume Evaluator workflow.
3. In `Resume Rewriter`, re-select your Resume Rewriter workflow.
4. In `Google Gemini Chat Model`, attach a valid `Google Gemini(PaLM) API` credential.

The default IDs in the JSON are set from your reference:
- Resume Guidelines: `D6wtOJ5nb0ysAxWf`
- Resume Evaluator: `hmEaJaGCu9sLtdbS`
- Resume Rewriter: `gdLijedBkzCMWgtC`

## Webhook URL
Path used by workflow:
- `job-match-enhancement`

Set in app `.env.local`:

```env
N8N_JOB_MATCH_WEBHOOK_URL=https://<your-n8n-host>/webhook/job-match-enhancement
```

## Gemini API Setup in n8n
Open node `Google Gemini Chat Model` and set credential under:
- `Credential to connect with` -> `Google Gemini(PaLM) API`

Paste your Gemini key in that credential's `API Key` field.

## App Secret/Timeout
Set in app `.env.local`:

```env
N8N_WEBHOOK_SECRET=<same-optional-shared-secret>
N8N_WEBHOOK_TIMEOUT_MS=120000
```

## Request Contract (from app)
```json
{
  "resumeData": {"...": "..."},
  "jobDescription": "...",
  "source": "job-match-api"
}
```

Troubleshooting:
- In n8n Webhook node data is often under `body.*`.
- If `Call 'Resume Guidelines'` shows `prompt = undefined`, set its input expression to:
  `{{ $json.body?.jobDescription || $json.jobDescription || 'Provide resume optimization guidelines for this job description.' }}`

## Response Contract (to app)
Must return exactly:
- `originalScore` number
- `improvedScore` number
- `improvedResume` object
- `analysis` string

If this workflow fails, your backend already falls back to LangChain automatically.
