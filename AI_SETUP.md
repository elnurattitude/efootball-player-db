# eFOOT TACTICS — Gemini Vision setup

## 1. Gemini API key
Google AI Studio: https://aistudio.google.com/app/apikey
Create/use an API key only if the account holder is eligible under Google's current age and account terms. If you are not eligible, do not create an account or bypass the age rules; ask a parent/guardian to review and manage an authorized setup. Never paste the key into this repository, website, or chat.

Gemini free-tier usage has limits. Google says free-tier content may be used to improve its products. The site therefore asks for explicit consent before sending screenshots. Do not upload account credentials, QR codes, private messages or personal data.

## 2. Cloudflare Worker
1. Sign in to Cloudflare → Workers & Pages → Create Worker (name: efoot-tactics-ai).
2. Open Edit code and replace the sample with the contents of cloudflare-worker.js.
3. Deploy.
4. Worker Settings → Variables and Secrets → Add → Secret.
5. Secret name: GEMINI_API_KEY. Paste your Gemini key there and save. Never commit the key.

Cloudflare's free Workers plan currently lists up to 100,000 requests/day. Gemini has separate free-tier quotas; a 429 response means a quota/rate limit was reached. Limits can change.

## 3. Connect the website
1. Copy your Worker URL, e.g. https://efoot-tactics-ai.YOUR-SUBDOMAIN.workers.dev
2. On the website, enter that URL with /analyze at the end.
3. Select screenshots, check the consent box and run AI analysis.

## Notes
- Images are resized in the browser in color-preserving format and sent to Gemini only after consent. OCR preprocessing remains separate.
- The Worker allows requests from https://elnurattitude.github.io only.
- The API key stays in Cloudflare Secrets, not in the browser.
- AI can misread player cards, ratings, positions and manager information. Verify in-game.
- This is an initial working integration, not a guarantee of perfect recognition or optimal tactics. Add production-grade abuse protection before a large public launch.
