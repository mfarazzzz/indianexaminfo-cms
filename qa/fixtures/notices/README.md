# Notice regression corpus — how to add a notice and read the per-field yield

Owner batch 9, H1. This folder is the input for the extractor's yield harness. It is **empty on
purpose**: the corpus is built from the owner's real notices, and until a real one is dropped
here the harness reports "no fixtures" and passes. No synthetic notice text was invented to fill
it — a fixture nobody actually had to read would measure nothing.

## 1. Add a notice

Save the notice's **text** (not the PDF, not a screenshot) as a plain `.txt` file in this folder:

```
qa/fixtures/notices/up-police-constable-2026.txt
qa/fixtures/notices/mp-jail-prahari-2026.txt
```

Rules:

- **File name = the notice**, lowercase, hyphenated, with the year. It is only a label; it is
  never parsed into a field.
- **UTF-8.** Devanagari must survive the copy. If a `.txt` opens with `????`, the copy was made
  in the wrong encoding and the harness will under-report — re-save it, do not "fix" the regexes
  around it.
- **Paste what is on the notice**, headings and all. Do not tidy the labels, do not delete the
  lines the extractor misses — those lines are the evidence.
- **No personal data.** Strip applicant names, phone numbers and addresses before saving.
- Three to five notices is the intended size. One is enough to start.

## 2. Run the harness

```
cd d:\GitHub\indianexaminfo-cms
npx vitest run src/lib/vacancy/noticeYield.harness.test.ts
```

It prints, for every fixture, one line per extractor field (`found` / `—`) with the value, then
a **corpus yield** table: how many notices produced each field. Read it like this:

```
field                  up-police  mp-jail  corpus
notificationDate       found      —        1/2
applicationEndDate     found      found    2/2
vacancyCount           —          found    1/2
```

A `—` is the only thing worth acting on. It means the notice had the fact on the page and the
extractor did not read it (or the notice genuinely does not contain it — the printed `notes` and
`unmatched` lines are how you tell those two apart).

## 3. What the harness will not do

- **It never invents a value.** A field is either read from a line of the notice or reported as
  missing.
- **It does not assert a minimum yield.** It prints numbers; it fails only on a structural
  defect (a duplicate proposal for one field, an empty value, a refused value proposed anyway).
  A growing corpus should never turn red because an old notice is still imperfect.
- **It does not change the extractor.** Improving the regexes for the Hindi/English mixed labels
  is a separate, deliberate change, made only after a real notice shows which label it missed.

## 4. The labels and date shapes the extractor is expected to grow into

Named by the owner in batch 9 (H1), to be added **only** when a real notice in this folder misses
them:

| fact | Hindi labels seen in real notices | English labels |
|---|---|---|
| last date | अंतिम तिथि, आवेदन की अंतिम तिथि | Last date, Last date to apply, Closing date |
| posts | पदों की संख्या, कुल पद | Total posts, No. of posts, Vacancies |
| fee | शुल्क, आवेदन शुल्क | Application fee, Fee |
| age | आयु सीमा | Age limit, Age as on |
| start | ऑनलाइन आवेदन प्रारंभ | Online application starts, Application begins |

Date shapes: `dd/mm/yyyy`, `dd.mm.yyyy`, `5 January 2026`, `05-Jan-2026`, and Devanagari digits
(`१५/०९/२०२६`). A two-digit year is completed against the cycle year; a date with no year is
completed the same way and is **always** mentioned in `notes`.

## 5. The copy guard is not negotiable

Every proposed value still passes the guard in `src/lib/vacancy/vacancyNoticeFields.ts`:
`data` and `name-exempt` pass by construction, wording must be far enough from the notice's own
line, and a value that is too close is refused and never proposed. A regex change that increases
yield by copying notice wording out is a regression, not an improvement — the harness prints the
guard verdict per proposal so that can be seen.
