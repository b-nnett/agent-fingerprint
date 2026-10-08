# agent-fingerprint

Browser evidence collection and heuristic classification of automated visitors, their declared agent identity, and their likely browser provider. Headless components and Next.js route handlers; no UI or hosted service required.

## Install from GitHub

```sh
npm install github:b-nnett/agent-fingerprint#v0.1.5
```

This repository includes compiled ESM and TypeScript declarations. It is not published to the npm registry.

## Next.js App Router

Create `app/api/agent/route.ts`:

```ts
import { createAgentRoute } from 'agent-fingerprint/next';
export const POST = createAgentRoute();
```

Mount this client component where you want collection to start:

```tsx
'use client';
import { AgentFingerprint } from 'agent-fingerprint/react';
export function DetectVisitor() {
  return <AgentFingerprint
    endpoint="/api/agent"
    onResult={result => console.log(result.suspectedIdentity, result.automation)}
    onError={console.error}
  />;
}
```

It renders nothing, collects once per mount, sends the report to your own route and returns the classification. Unmounting cancels submission; callbacks can change without starting another collection. It requests no device permissions, performs no extension URL scanning, uses no external STUN server, and sends nothing to this project's author or any hosted evidence service. Collection uses canvas, WebGL, fonts, offline audio, math, device hints, browser integrity and available browser APIs. Mount after any consent required by your app. A fingerprint is evidence about an environment, not proof of a person or identity.

Collection is browser-only. Import server classification from `agent-fingerprint` or `agent-fingerprint/next`; import browser collection from `agent-fingerprint/client`. The optional React export requires React 18+; core classification has no runtime dependencies. Works with Node or Edge route handlers using standard Request/Response APIs.

## Return values

- `suspectedIdentity`: displayed origin, including an unverified HTTP user-agent claim.
- `identityBasis`: `User-agent claim`, `Browser annotation runtime`, `Reference match`, `General browser environment` or `Insufficient evidence`.
- `probableOrigin`: reference-supported origin, or `Unknown`.
- `confidence`: `low`, `medium` or `unknown`; never a calibrated probability.
- `browser`: environment assessment, blockers and supporting reasons, independent of exact fingerprint references.
- `automation`: score, assessment and supporting reasons. Generic automation can be recognised without attributing a provider.
- `candidates`, `referenceMargin`, `referenceSamples`: the evidence behind the guess.

An unseen browser can return **Real Browser** with `identityBasis: "General browser environment"` and low confidence. This requires a recognised browser with coherent platform/client hints, explicitly disabled WebDriver, measured canvas/fonts/screen data, hardware rendering, and no strong automation indicators. It does not require matching a stored personal fingerprint. Provider claims, runtime hints, reference matches and conflicting provider references take precedence. `probableOrigin` stays `Unknown` for this fallback because a plausible browser environment does not identify its operator.

A stealth agent can expose all of those signals. **Real Browser means a browser-like environment with no detected agent evidence, not verified human control.** Removing provider references lets some known stealth services satisfy the fallback, so the general heuristic is not a standalone human-versus-bot test.

The browser provider and the agent controlling it can differ. Header claims can be spoofed; real and automated Chrome may share a fingerprint. Do not use this as an authentication system or automatically treat `Unknown` as human.

## Store reports and add labelled references

```ts
export const POST = createAgentRoute({
  references: async () => loadYourLabelledReferences(),
  onCapture: async ({ evidence, classification, request }) => {
    const id = await savePrivately({ evidence, classification });
    return { id };
  },
});
```

Both callbacks are optional. `references` replaces bundled profiles and accepts an array or async loader. A reference is `{ id, origin, evidence }`; `origin` must be a member of the exported `origins`. `onCapture` receives the original request, so your app can read trusted platform IP metadata server-side. Nothing is stored by default. Authentication, rate limits, retention and label management belong to your app. The route bounds input to 256 KiB, rejects conflicting Origin headers and validates the report envelope; all telemetry remains client-controlled.

## Low-level usage

```ts
import { collect, compactReport } from 'agent-fingerprint/client';
const evidence = compactReport(await collect());

// On the server:
import { classify } from 'agent-fingerprint';
const result = classify(evidence, { userAgent: request.headers.get('user-agent') || '' });
```

`collect({ networkEndpoint: '/api/network', signal })` optionally includes JSON from your own network metadata endpoint. No network metadata request is made by default. `classify(evidence, { references: [] })` disables reference matching. `detect(evidence, userAgent, references)` exposes the raw classifier.

## Detection and validation dates

Dates use `YYYY-MM-DD`. “Detection added” records when support entered this package; “Last validated” records the latest completed check. ✅ means working within the stated validation scope. These dates describe package v0.1.5 / detector v11.

| Identity | Detection added | Last validated | Validation scope | Result |
| --- | --- | --- | --- | --- |
| Codex Browser | 2026-10-08 | 2026-10-08 | Live capture on `b-nnett.com/fp`, plain Chrome HTTP headers, injected annotation shadow root | ✅ |
| ChatGPT web | 2026-10-08 | 2026-10-08 | Bundled labelled reference replay | ✅ |
| Grok bot | 2026-10-08 | 2026-10-08 | Bundled labelled reference replay | ✅ |
| Instinct | 2026-10-08 | 2026-10-08 | Bundled labelled reference replay | ✅ |
| Kernel.sh | 2026-10-08 | 2026-10-08 | Bundled labelled reference replay | ✅ |
| Steel | 2026-10-08 | 2026-10-08 | Bundled labelled reference replay | ✅ |
| Browser Use | 2026-10-08 | 2026-10-08 | Bundled labelled reference replay | ✅ |
| Hyperbrowser | 2026-10-08 | 2026-10-08 | Bundled labelled reference replay | ✅ |
| Notte | 2026-10-08 | 2026-10-08 | Bundled labelled reference replay | ✅ |
| Cloudflare Browser Run | 2026-10-08 | 2026-10-08 | Bundled labelled reference replay | ✅ |
| Browserbase | 2026-10-08 | 2026-10-08 | Confirmed working by the project owner | ✅ |
| OpenAI dots | 2026-10-08 | 2026-10-08 | Confirmed working by the project owner | ✅ |
| Claude | 2026-10-08 | 2026-10-08 | Owner-labelled desktop captures; Claude HTTP user-agent token | ✅ |
| Real Browser | 2026-10-08 | 2026-10-08 | Arc, Chrome, Safari/private-mode and iOS captures with personal references disabled (development evaluation) | ✅ |

All bundled samples passed reference replay on 2026-10-08. The samples are also the classifier's references, so this measures reproduction of known profiles, not accuracy on independent or unseen sessions. The live Codex result validates browser integration detection; it does not establish active agent control or a verified provider origin. The package tests passed on the same date.

> Some default Browserbase configurations may be marked as **Instinct**, as Instinct uses Browserbase. Shared infrastructure can make the two indistinguishable.

Claude local-browser captures can share the user’s device fingerprint with regular Chrome and other agents. Claude desktop’s `Claude/<version>` user-agent token identifies its declared browser environment even when rendering profiles overlap. Labels remain private; rendering profiles alone stay `Unknown`. One owner-labelled capture instead reported Android Chrome with no Claude token and remains `Unknown`; the tick above applies to the desktop token path.

To reproduce the reference replay against the installed package:

```js
import { classify, referenceProfiles } from 'agent-fingerprint';

const results = new Map();
for (const { origin, evidence } of referenceProfiles) {
  const row = results.get(origin) ?? { correct: 0, unknown: 0, wrong: 0, total: 0 };
  const predicted = classify(evidence).probableOrigin;
  row.total++;
  row[predicted === origin ? 'correct' : predicted === 'Unknown' ? 'unknown' : 'wrong']++;
  results.set(origin, row);
}
console.table(Object.fromEntries(results));
```

Update the validation date and result only after repeating the stated check. Record new provider configurations and independent sessions separately from reference replay; retain failures and `Unknown` outcomes in the counts.

## Reference provenance and limits

The initial provider profiles derive from labelled experiments on 8 October 2026 for ChatGPT web, Grok bot, Instinct, Kernel.sh, Steel, Browser Use, Hyperbrowser, Notte and Cloudflare Browser Run. They contain rendering features and synthetic reference IDs; no IPs, full capture bodies, timestamps, device IDs or personal-browser samples are included. Browserbase, Claude, Codex Browser and OpenAI dots also support explicit user-agent claims, but do not all have empirical provider references in this dataset.

Matching uses weighted canvas/font/audio/GPU families, discounts features shared across origins, requires independent anchor families and a winning margin. Notte's repeated small rendering perturbations have a conservative approximate-match rule. Overlapping profiles remain `Unknown`. These are initial samples from a limited set of configurations, not a benchmark of accuracy on unseen traffic. Provider upgrades, regions, operating systems, privacy features and adversarial changes can invalidate matches. Train on known launches and evaluate on separate sessions.

Personal browser profiles can be added privately as `Real Browser`. A lack of automation signals alone never establishes that label. The package intentionally does not publish the author's personal-device reference fingerprints. Real Browser matching checks OS and browser engine compatibility and rejects declared WebDriver automation. Claude and Codex device references cannot establish app identity; explicit user-agent or runtime markers take precedence. Private-mode rendering can differ and may need a separately labelled reference.

## Development

```sh
npm ci
npm run build
npm test
npm pack
```

MIT licensed. No Pokémon artwork, logos, animation or presentation code is included.

Codex desktop can restrict its HTTP browser marker to OpenAI domains. The collector also checks for its injected annotation root with an open shadow DOM on custom domains. This is an unverified browser integration hint, can be imitated, and does not prove active agent control. An absent marker does not prove a human visitor.
