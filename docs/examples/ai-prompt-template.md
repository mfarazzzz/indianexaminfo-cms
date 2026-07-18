# Example: Adding a New AI Prompt Template

> How to add a new AI generation capability to the CMS.

---

## Scenario: Adding "AI Exam Comparison" Generator

We want AI to generate a comparison table between two exams.

---

## Step 1: Add the Prompt Template

```typescript
// In src/lib/gemini/prompts.ts — add to DEFAULT_PROMPTS:

examComparison: (v: PromptVars & { examName2?: string }) =>
  `Compare two Indian competitive exams: "${safe(v.examName)}" vs "${safe(v.examName2)}".
Return a JSON object with this structure:
{
  "comparison": [
    { "aspect": "Conducting Body", "exam1": "...", "exam2": "..." },
    { "aspect": "Exam Mode", "exam1": "...", "exam2": "..." },
    { "aspect": "Eligibility", "exam1": "...", "exam2": "..." },
    { "aspect": "Difficulty Level", "exam1": "...", "exam2": "..." },
    { "aspect": "Career Prospects", "exam1": "...", "exam2": "..." },
    { "aspect": "Salary Range", "exam1": "...", "exam2": "..." }
  ],
  "recommendation": "Brief recommendation for students choosing between these..."
}
Return only valid JSON.`,
```

---

## Step 2: Create the UI Trigger

```typescript
// In the relevant editor component:
import { generateWithGemini } from '@/lib/gemini/client'
import { DEFAULT_PROMPTS } from '@/lib/gemini/prompts'
import { useSettings } from '@/contexts/SettingsContext'

function ComparisonGenerator({ examName }: { examName: string }) {
  const { getSetting } = useSettings()
  const [exam2, setExam2] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    const apiKey = getSetting('gemini_api_key')
    if (!apiKey) {
      toast.error('Configure Gemini API key in Settings → AI')
      return
    }

    setLoading(true)
    try {
      const prompt = DEFAULT_PROMPTS.examComparison({
        examName,
        examName2: exam2,
      })
      const response = await generateWithGemini(prompt, apiKey as string)
      setResult(JSON.parse(response))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <input
        value={exam2}
        onChange={(e) => setExam2(e.target.value)}
        placeholder="Compare with... (e.g., SSC CGL)"
        className="w-full rounded border px-3 py-2"
      />
      <button onClick={handleGenerate} disabled={loading || !exam2}>
        {loading ? 'Generating...' : 'Generate Comparison'}
      </button>

      {/* Preview Panel — AI never directly saves */}
      {result && (
        <div className="rounded border bg-blue-50 p-4">
          <h4 className="font-medium">AI Generated Comparison (Preview)</h4>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr><th>Aspect</th><th>{examName}</th><th>{exam2}</th></tr>
            </thead>
            <tbody>
              {result.comparison.map((row: any, i: number) => (
                <tr key={i}>
                  <td className="font-medium">{row.aspect}</td>
                  <td>{row.exam1}</td>
                  <td>{row.exam2}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex gap-2">
            <button onClick={() => {/* Insert into content */}}>Accept</button>
            <button onClick={() => setResult(null)}>Dismiss</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## Key Principles Followed

1. **Preview panel** — User sees AI output before it enters the form
2. **Accept/Dismiss** — User has explicit control
3. **Input sanitization** — Exam names are sanitized via `safe()`
4. **Error handling** — API failures show toast, don't crash
5. **Settings-driven** — API key comes from settings table, not hardcoded
6. **No direct DB writes** — AI generates data, service layer persists
