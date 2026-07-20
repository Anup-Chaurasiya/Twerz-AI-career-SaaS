# ATS Beater browser extension (MVP)

Capture a job description from major job boards and create a job in ATS Beater.

## Install

1. Open Chrome → **Extensions** → **Load unpacked** → select this `extension/` folder.
2. On the ATS Beater web app, copy your JWT from DevTools → Application → Local Storage → `token`.
3. Paste the JWT into the extension popup, enter your **profile ID**, and open a job page.
4. Click **Create job** — opens `/dashboard/jobs/{id}` to analyze fit and generate.

**Note:** Extension capture requires **Job Hunt Pro** or an active time pass (API returns 402 otherwise).

## Supported boards

| Site | Extractor |
|------|-----------|
| linkedin.com/jobs | Role, company, description selectors |
| naukri.com | JD header + description selectors |
| indeed.com | Job info header + `#jobDescriptionText` |
| wellfound.com / angel.co | Title + description sections |
| boards.greenhouse.io / `*.greenhouse.io` | `#content` / app-title |
| jobs.lever.co | `.posting-headline` + `.content` |

If selectors miss (page redesign / A/B), the popup shows a **warning** — paste the JD manually. The content script does **not** use `document.body.innerText` as the primary source (avoids nav/ads).

## Manual pressure checklist

- [ ] LinkedIn job page fills role/company/description without warning
- [ ] Naukri job page fills description (or warns clearly)
- [ ] Indeed job page fills `#jobDescriptionText`
- [ ] Wellfound / AngelList job page fills role + description (or warns)
- [ ] Greenhouse public board job fills `#content` (or warns)
- [ ] Lever `jobs.lever.co` posting fills description (or warns)
- [ ] Non-job page shows warning and empty description
- [ ] Create job returns `job_id` and opens the dashboard
- [ ] Without Pro / time pass, API returns clear paywall (402)

API: `POST /extension/capture-job` (Bearer JWT required; Pro or time pass gated).
