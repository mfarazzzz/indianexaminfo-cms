# Verify next — the 25 exams to verify, and how to verify one in five minutes

**Owner batch 6, Phase Z2. Read-only: nothing here was verified, edited or written.**
Generated 2026-11-06 against the live database (`cwbhhcqsrbuoybeaondk`). The ranking rule is the
one the CMS actually ships, not a paraphrase of it — see "How this list is ordered".

---

## 1. The snapshot today

From `exams`, excluding reference rows (`slug like 'zz-test%'`), joined to their current edition:

| measure | count | what it means |
|---|---:|---|
| published exams (non-test) | **399** | `is_published` and `workflow_status='published'` agree exactly |
| verified (non-test) | **0** | see the note below |
| published and unverified | **399** | the whole published catalogue is unverified |
| **ready to verify now** (no data blocker) | **286** | name, conducting body, official website, selection question answered, ≥1 valid important date, no duplicate same-day rows |
| need data first — no valid important date | **103** | nothing date-shaped to confirm |
| need data first — official website missing | **3** | cannot check a fact against a source |
| need data first — duplicate same-day rows | **9** | the record contradicts itself; `verifyBlockReasons` refuses |
| need data first — conducting body empty | **0** | |
| need data first — selection question unanswered | **0** | |

**The verified count is the finding.** `select count(*) from exams where is_verified` returns 5,
and all five are reference rows:

| slug | verified_at |
|---|---|
| `zz-test-board-exam` | 2026-10-22 18:17:29+00 |
| `zz-test-entrance-exam` | 2026-10-22 17:40:12+00 |
| `zz-test-government-exam` | 2026-10-22 17:43:12+00 |
| `zz-test-govt-vacancy` | 2026-10-22 18:16:32+00 |
| `zz-test-university-exam` | 2026-10-22 17:45:41+00 |

Those are the rows the verify flow was tested against on 22 Oct. **No real exam has ever been
verified**, which is why the reader-facing "verified" signal is absent site-wide and why the JobPosting
gate (`structured-data.ts` requires `verifiedAt` non-null) emits nothing for vacancies.

---

## 2. How this list is ordered (the rule as it is written, not as it was described)

`src/services/examService.ts:381-396` `getVerificationQueue()` → `src/lib/exams/verification.ts:179-189`
`sortQueueRows()`, whose comment is "nearest upcoming date first, no-date rows last, then featured.
Rows with a date tie-break by date, then featured":

1. `nextDate` ascending — the nearest **strictly future** valid `YYYY-MM-DD` date among the current
   edition's `important_dates` (`pickNextUpcomingDate`, `verification.ts:46-52`);
2. rows with **no** upcoming date go last;
3. `is_featured` true first;
4. name A→Z.

**One deviation from the brief, stated plainly:** the brief said "nearest upcoming date, then
featured, government first". The shipped comparator has **no government-first term** — pillar is
carried on the row but never compared. This list follows the code, because a worklist that does not
match the queue the editor shows would be a second source of truth. If "government first" is the
intent, it is a two-line change to `sortQueueRows` plus its test — say the word.

The blockers in the "missing" column are the same `verifyBlockReasons()` the editor's Verify button
reads (`verification.ts:81-92`), so nothing here can disagree with what the button will say.

---

## 3. The next 25

Today is 2026-11-06, so rank 1 is tomorrow's deadline. "Source" is the host stored on the record —
the link to open, not a link to trust.

| # | slug | name | pillar | next date | source host | missing / blockers |
|---:|---|---|---|---|---|---|
| 1 | `up-ecce-educator` | UP ECCE Educator Vacancy 2026 | govt-vacancy | 2026-11-07 | sewayojan.up.nic.in | — ready |
| 2 | `assam-grade-iv-2026` | Assam Direct Recruitment Grade IV | govt-vacancy | 2026-11-08 | slrcassam.in | — ready |
| 3 | `ibps-clerk` | IBPS Clerk | government-exam | 2026-11-09 ⭐ | www.ibps.in | — ready |
| 4 | `rajasthan-gram-sevak-2026` | Rajasthan Gram Sevak Recruitment | govt-vacancy | 2026-11-10 | rsmssb.rajasthan.gov.in | — ready |
| 5 | `tn-police-constable-2026` | Tamil Nadu Police Constable | govt-vacancy | 2026-11-10 | www.tnusrb.tn.gov.in | — ready |
| 6 | `up-lekhpal-bharti-2026` | UP Revenue Lekhpal Bharti | govt-vacancy | 2026-11-15 ⭐ | upsssc.gov.in | — ready |
| 7 | `gpsc` | GPSC Class 1-2 (Gujarat State Services) | government-exam | 2026-11-15 | gpsc.gujarat.gov.in | — ready |
| 8 | `rbi-assistant` | RBI Assistant | government-exam | 2026-11-15 | www.rbi.org.in | — ready |
| 9 | `opsc-oas` | OPSC OAS (Odisha Administrative Service) | government-exam | 2026-11-16 | www.opsc.gov.in | — ready |
| 10 | `uksssc-group-c-scaler` | UKSSSC Group C Scaler Recruitment | govt-vacancy | 2026-11-19 | sssc.uk.gov.in | **2 duplicate same-day rows** |
| 11 | `odisha-teacher-2026` | Odisha CT/BEd Teacher Recruitment | govt-vacancy | 2026-11-20 | www.ossc.gov.in | — ready |
| 12 | `upsssc-lekhpal` | UPSSSC Lekhpal (Revenue Accountant) | government-exam | 2026-11-20 | upsssc.gov.in | — ready |
| 13 | `gujarat-talati-2026` | Gujarat Talati cum Mantri (Village Accountant) | govt-vacancy | 2026-11-22 | gpssb.gujarat.gov.in | — ready |
| 14 | `clat` | Common Law Admission Test 2026 | entrance-exam | 2026-11-25 ⭐ | consortiumofnlus.ac.in | — ready |
| 15 | `ssc-constable-gd-2` | Delhi Police Constable | government-exam | 2026-11-28 | ssc.gov.in | — ready (and see W3: the slug, not the name, is the problem) |
| 16 | `up-assistant-accountant-2026` | UP Sahayak Lekhakar (Assistant Accountant) | govt-vacancy | 2026-11-28 | upsssc.gov.in | — ready |
| 17 | `cat` | Common Admission Test (CAT) | entrance-exam | 2026-11-29 | **(none stored)** | **official website missing + 2 duplicate same-day rows** |
| 18 | `ignou-exam` | IGNOU Term End Examination | university-exam | 2026-12-01 ⭐ | www.ignou.ac.in | — ready |
| 19 | `rrb-group-d` | RRB Group D (Level 1) | government-exam | 2026-12-01 ⭐ | www.rrbcdg.gov.in | — ready |
| 20 | `aktu-exam` | AKTU (Dr. APJ Abdul Kalam Technical University) Exams | university-exam | 2026-12-01 | www.aktu.ac.in | — ready |
| 21 | `kvs-tgt-pgt` | KVS TGT/PGT Teacher Recruitment | government-exam | 2026-12-01 | www.kvsangathan.nic.in | — ready |
| 22 | `up-junior-assistant-2026` | UP Junior Assistant/Stenographer | govt-vacancy | 2026-12-05 | upsssc.gov.in | — ready |
| 23 | `wbp-constable` | West Bengal Police Constable | government-exam | 2026-12-07 | www.wbpolice.gov.in | — ready |
| 24 | `up-krishi-sevak-2026` | UP Krishi Technical Sahayak | govt-vacancy | 2026-12-10 | upsssc.gov.in | — ready |
| 25 | `snap` | Symbiosis National Aptitude Test 2026 | entrance-exam | 2026-12-13 | www.snaptest.org | — ready |

⭐ = `is_featured`. 22 of the 25 are ready to verify right now; two need a data fix first
(`uksssc-group-c-scaler`, `cat`), and `cat` additionally needs its official website entered.

**The two that matter most are not in rank order.** `cat` (rank 17) is one of the highest-traffic
exams on the site and it has **no official source URL stored at all**, plus two date rows that
contradict each other — until both are fixed it cannot be verified and cannot emit trustworthy
structured data. Fix that one first if you are choosing by value rather than by deadline.

---

## 4. How to verify one exam in five minutes

1. Open the exam in the CMS (**Sarkari Naukri → the list it belongs to**, or the
   **Needs Verification** queue, which is already in this order) and note the **next date** shown.
2. Open the stored official link — the host in the table above, from the record's *Official
   website* field — and find that exam's current notification. Do not use a news site or an
   aggregator; the point of verification is that the record agrees with the conductor.
3. Compare exactly **three facts**, in this order, because they are the three readers act on:
   - **dates** — notification, application start and last date, exam date (check the *year* on each);
   - **vacancy and fee** — total posts, and the application fee per category;
   - **eligibility** — age range (with the cut-off date) and the qualification.
4. Where the record disagrees, **fix the record** in the editor (dates on the Important Dates tab,
   vacancy/fee on the edition, eligibility on Eligibility), then **Save**. Do not verify a row you
   have just changed without saving — the control refuses unsaved changes ("Save your unsaved
   changes first").
   If the official document simply does not say, leave the field empty rather than guessing: an
   absent fact is a gap, a wrong fact is misinformation.
5. Press **Verify this exam**. The control tells you the first reason it is still blocked, if any
   (missing official website, no valid important date, duplicate same-day rows, or "you need the
   Publish Exam permission"). The stamp is written to the record — `is_verified`, `verified_at`,
   `verified_by` — and it belongs to the exam, not to one edition.
6. Reload the public page and confirm the verified signal appears: `EntityDetailPage.tsx:730-736`
   shows a "Verified by … · <date>" pill when `getExamVerification(exam).kind === "verified"`, and
   the `UNVERIFIED_EXAM_NOTICE` line otherwise — so today every one of these 25 pages shows the
   unverified notice to readers. One exam at a time: there is no bulk verify anywhere, on purpose.

At five minutes each, the 22 ready rows above are about two hours of work; the 286 ready rows in
the whole catalogue are roughly 24 hours, which is a week of an editor's time, not a weekend.
