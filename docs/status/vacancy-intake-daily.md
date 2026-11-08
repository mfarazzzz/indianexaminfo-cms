># The daily vacancy intake routine

**Owner batch 8, Phase H4.** This is the routine for turning one official job notice into
one published, verified vacancy page. It is written for whoever does the work — the owner,
or an intern once an intern account exists.

**Why it is written this way.** About 91% of the site's clicks come from roughly 46 flat
vacancy pages (`/sarkari-naukri/<slug>`). A vacancy page only earns the "Job listing"
appearance while its application window is **open today**; an old row gives the reader a
last date and nothing else. So a vacancy that is published late, or published without its
window, is worth much less than the same vacancy published today — and the fields that
make it look like a job listing are exactly the fields this routine fills in.

**Total: about 10 minutes per notice.** Every number below was measured on the real
extractor against real notice text on 2026-11-08, not estimated.

---

## The five steps

| # | Step | Where | Minutes |
|---|---|---|---:|
| 1 | Collect the notice text | the official site | 2–4 |
| 2 | Paste it and extract | CMS → Vacancy listings → **Quick add from notice** | 1 |
| 3 | Check every proposal against the notice | same screen | 2 |
| 4 | Fill the gaps and create the draft | same screen → **Create draft** | 2 |
| 5 | Save + Verify | the edit page it opens | 1–2 |

---

### 1 — Collect the notice text  *(2–4 min)*

Open the official notice on the department's own site. Copy **the text of the notice** —
the "Important Dates" block, the post count, the fee table and the age limit. Keep the
official page open: you need its address for step 2.

Copy the **notification URL** and the **apply URL** as well. These are two separate links
and they go in two separate boxes.

> **If the site blocks the fetch** (a captcha, a "verify you are human" page, a login, a
> PDF that will not render): open it in a normal browser window, read it like a reader
> would, and select the text of the notice by hand — the "Important Dates" block, the
> post count line, the fee lines, the age line. That is all the extractor needs. Paste
> it into the textarea. The system never fetches the URL for you and never should: a
> blocked fetch is a decision by the department, and working around it silently is not
> something to automate. The URL you paste is stored as a link for the reader; it is
> never opened by the CMS.

### 2 — Paste it and extract  *(1 min)*

CMS → **Vacancy listings** → the **Quick add from notice** button (top right, next to
**New Vacancy**).

- Paste the notice text into the big box.
- Paste the **official notification URL** and the **application URL** into their two
  boxes. These are the form's own fields — what you type here is what the row gets.
- Press **Extract the fields**.

Nothing is fetched, no PDF is read, no OCR runs. The extractor is a deterministic parser:
the same text always gives the same proposals.

### 3 — Check every proposal against the notice  *(2 min)*

Each proposal shows the **source line** it came from, under the value. Read the value,
read the source line, and press **Accept** or **Edit** — per field. Accepting writes to
the **form only**; nothing reaches the database until you press **Create draft**.

You will usually see:

| Field | Where it comes from |
|---|---|
| Notification date | the notice's own "Notification Date" line |
| Application start | "Online Application Starts" / "Commencement of Application" |
| Last date to apply | "Last Date to Apply" / "Closing Date" |
| Total posts | "Total No. of Posts" / "Number of Vacancies" |
| Application fee | the fee lines, as `category: amount` pairs |
| Age limit | the age lines, as a `min-max years` range |
| Title | the notice's first line (a name — exempt from the copy guard) |

Anything the extractor could not read is listed underneath as a **note** ("to be
notified"), a **conflict** (two lines claimed the same slot — the winner is stated), or
an **unmatched** line. Read those too: a fee-payment last date, for example, is not the
application end date, and the extractor deliberately leaves it alone.

If a proposal is marked **refused by the copy guard**, it is not offered — the value was
too close to the notice's own wording. Write the value yourself in the form.

### 4 — Fill the gaps and create the draft  *(2 min)*

Still on the same screen. These cannot be read out of a notice reliably, so they are
yours to set:

- **Title** — the job's name, as readers search for it.
- **Slug** — press **Propose** and check it. The proposal follows the pattern the live
  rows use (state token, subject, year). Two states are abbreviated in the corpus
  (`up-…`, `mp-…`) and the rest are spelled out (`andhra-pradesh-…`, `west-bengal-…`);
  the proposer now matches that.
- **Organization** — the recruiting body's name.
- **State** — the routing key. All India for a national vacancy.
- **Category** and **Recruitment type** — optional, but the category is what the
  footer and category hubs group by.

**The duplicate check runs on its own.** If the notice looks like one you already have,
the screen shows a link to the existing row. Open it and add the new dates to **that**
row. Two copies of one notice split the clicks between two URLs and neither one wins.

Then press **Create draft**. It creates a **draft**. Nothing is published from this
screen — publishing is a separate, permissioned act in step 5.

### 5 — Save + Verify  *(1–2 min)*

The draft opens on the edit page. The checklist at the top of that page says exactly
what is still missing for the page to look like a job listing:

| # | Checklist item | Why it matters |
|---|---|---|
| 1 | Notification date | the JobPosting `datePosted`/notice field |
| 2 | Application start | when the reader can act |
| 3 | Last date to apply | the JobPosting `validThrough` |
| 4 | **Window open today** | a closed window only leaves a last date on the page |
| 5 | Official notification link | the source; also required before verification |
| 6 | Application link | where the reader applies |
| 7 | Verified against the notice | the honest stamp that the notice was actually read |

Fill anything still empty, then press **Save + Verify**. It saves first and verifies
second, and it runs the **existing** verify path — the same one the standalone Verify
button runs, with the database trigger (`trg_sarkari_verify`) as the authority.

It refuses, in plain words, when there is no official http(s) notification link, when
there is no last date to apply, or when the account lacks the publish permission. A
refusal is shown to you; the row stays **unverified**. Nothing on this page ever
verifies a row on its own — the only way a row gets verified is somebody pressing that
button.

**And after publishing, check that the window is still open today.** A row whose window
has closed will still show its last date; that is expected and is not a bug. The rows
that earn the job-listing appearance are the fresh ones.

---

## If the extractor finds nothing

Fill the form by hand. This happens with notices that are images, or that use a layout
the parser does not recognise. Nothing is lost — the form has every field.

## What the extractor got wrong on the two real notices measured

| Notice | Proposals found | What was wrong |
|---|---:|---|
| The repo's realistic official-notice fixture | 7 | none — but "Fee Payment Last Date: 2026-09-10" was correctly **not** used as the application end date |
| A live production row's own text (`rajasthan-police-constable-driver-2026`) | 3 | the post count on a `Vacancies: 750` line was being dropped; **fixed** on 2026-11-08 |

## The rules this routine keeps

- **A draft is a draft.** The quick-add screen cannot publish anything.
- **Never auto-verify.** Verification is a human pressing a button, every time.
- **Never a near-duplicate.** A hit links to the existing row instead of creating a
  second copy.
- **Facts in our words, not the notice's prose.** The copy guard runs on every proposal
  and refuses the ones that would copy the notice.
- **No fetching.** The CMS never opens the URL you paste, never scans a PDF, never
  OCRs. The notice comes to the CMS, not the other way round.

## Where the numbers come from

Live database, read-only, 2026-11-08:

| measure | value |
|---|---:|
| `sarkari_naukri` rows | 361 |
| published | 361 |
| **rows with `verified_at` set** | **0** |
| newest published rows with **every** gated field NULL (notification date, start, end, official URL, apply URL, count, age, fee) | 5 of the 5 newest |
| JobPosting checklist items | 7 |

The last two rows are the whole point of this routine: as of 2026-11-08 no row on the
site is verified, and the newest rows carry none of the fields a job listing needs. That
is the gap steps 1–5 close.
