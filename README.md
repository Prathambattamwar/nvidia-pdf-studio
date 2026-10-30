# Topic-to-PDF Generator — Google Search Edition

A local web application that turns a topic into a structured PDF using NVIDIA-hosted Nemotron and Google Programmable Search Engine (PSE).

## What's new in v1.1.8

- Uses NVIDIA's Chat Completions `response_format: json_schema` strict structured-output mode instead of relying only on a free-form JSON instruction.
- Uses `reasoning_effort=none` for document-writing requests so the output budget is reserved for the document.
- Raises output budgets for brief, standard, and detailed documents.
- Validates every required field before the PDF renderer receives the response.
- Automatically retries malformed or truncated responses with a second constrained-JSON recovery request.
- Uses a new default port, 3280, to avoid the older v1.1.7 server on 3279.

## Features

- Browser UI for topic, document type, length, audience, and writing style.
- Automatic background Google PSE research; no separate search panel is displayed.
- Structured PDFs with a light cover, overview, contents, sections, conclusion, takeaways, page numbers, and clickable source URLs.
- Primary and fallback Nemotron model settings.
- Clean exports: no application name, generator credit, or library attribution is printed in the document or its metadata.
- Minimal browser interface; NVIDIA and Google credentials stay in the server-side `.env` file.

## Requirements

- Node.js 20 or later.
- An NVIDIA API key from https://build.nvidia.com/
- A Google Programmable Search Engine ID and internet access for live research.

## Install on Windows

1. Extract this ZIP into a **new folder**. Do not merge it over an older project.
2. Open PowerShell in that new folder.
3. Run:

   ```powershell
   npm install
   Copy-Item .env.example .env
   notepad .env
   ```

4. Add your NVIDIA API key. Keep `TOPIC_PDF_PORT=3280`:

   ```env
   NVIDIA_API_KEY=your_real_nvidia_api_key
   NVIDIA_CHAT_BASE_URL=https://integrate.api.nvidia.com/v1
   NVIDIA_CHAT_MODEL=nvidia/nemotron-3.5-super-vl-120b-a12b
   NVIDIA_FALLBACK_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
   GOOGLE_CSE_ID=04321f7157f034584
   TOPIC_PDF_PORT=3280
   ```

5. Run `npm run check`, then `npm start`.
6. Open **http://localhost:3280**. Before generating a PDF, open **http://localhost:3280/api/health** and verify the build ID is `1.1.8-structured-output-recovery`, port `3280`, and `structuredOutput` is `json_schema-with-automatic-recovery`.

The app reads `TOPIC_PDF_PORT`. The new default is 3280 so it does not silently connect to the old 3279 instance.

## Google Programmable Search Engine

The configured engine ID is `04321f7157f034584`. It is supplied to the hidden Google PSE element at runtime. When live research is enabled, the browser requests results automatically before sending the source titles, URLs, and snippets to the server. Google snippets are not full article text; verify important claims using the linked sources.

To update your site list, use `google-cse-sites-49.txt` in the Google Programmable Search Engine control panel.

## Export safeguards

The server sanitizes all AI-generated document fields and source display text, wraps the final PDF text-rendering method as a last line of defense, and clears author, creator, and producer metadata before PDF finalization. Page numbers and source links remain available.

## Checks

```powershell
npm run check
```

The check covers JavaScript syntax, the document JSON schema, parsing of fenced/wrapped JSON, incomplete responses, required document fields, and the existing white-label regression suite.

## Troubleshooting

- **Health check shows a different build:** you are connected to another process or extracted folder. Stop old Node servers, launch `npm start` from this folder, and open `http://localhost:3280/api/health` again.
- **Port 3280 is occupied:** stop the process using it or change `TOPIC_PDF_PORT` in `.env` and restart.
- **NVIDIA 401:** verify the API key in `.env`.
- **NVIDIA 429/503:** the hosted model is busy or rate-limited; the fallback model is attempted when available. Retry if both endpoints are busy.
- **Structured output rejected:** this build automatically retries without the schema parameter if the API specifically reports that `response_format` is unsupported.
- **No live sources:** verify the PSE engine is enabled, the engine ID is correct, and your browser can load `cse.google.com`.

## Model settings

Primary: `nvidia/nemotron-3.5-super-vl-120b-a12b`

Fallback: `nvidia/nemotron-3.5-lightning-30b-a3b`
