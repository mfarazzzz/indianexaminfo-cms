/**
 * moduleAI.ts — AI content generation scoped to individual modules.
 *
 * Generates focused content for a specific module type using the exam context.
 */
import { generateWithGemini } from "@/lib/gemini/client";
import { validateAndFixDate, INDIAN_DATE_PROMPT_SHORT } from "@/lib/utils/indianDateParser";
import type { ExamIdentity, ExamEdition } from "@/services/entranceExamService";

interface ModuleAIContext {
  identity: ExamIdentity;
  edition: ExamEdition | null;
}

/**
 * Generate AI content for a specific module.
 * Returns structured data matching the module's field schema.
 */
export async function aiGenerateForModule(
  moduleSlug: string,
  examName: string,
  year: number,
  context: ModuleAIContext,
  apiKey: string,
  model?: string,
  rawContent?: string
): Promise<Record<string, unknown>> {
  const prompt = getModulePrompt(moduleSlug, examName, year, context, rawContent);
  if (!prompt) throw new Error(`No AI prompt defined for module: ${moduleSlug}`);

  const raw = await generateWithGemini(prompt, apiKey, model);

  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  // Strip trailing text after JSON
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace > 0 && lastBrace < cleaned.length - 1) {
    cleaned = cleaned.slice(0, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    // Post-process any date fields in the module response
    return fixModuleDateFields(moduleSlug, parsed);
  } catch {
    // If not JSON, treat as HTML body
    if (cleaned.includes("<") && cleaned.includes(">")) {
      return { body: cleaned };
    }
    return { body: `<p>${cleaned}</p>` };
  }
}

/** Fix date fields in module-specific responses */
function fixModuleDateFields(slug: string, data: Record<string, unknown>): Record<string, unknown> {
  const dateKeys = ["releaseDate", "declarationDate", "date", "applicationStartDate", "applicationEndDate", "lastDateFeePayment"];
  const result = { ...data };

  for (const key of dateKeys) {
    if (typeof result[key] === "string" && result[key]) {
      result[key] = validateAndFixDate(result[key] as string);
    }
  }

  // Fix dates in rounds arrays (counselling module)
  if (Array.isArray(result.rounds)) {
    result.rounds = (result.rounds as any[]).map((r: any) => {
      if (r && typeof r.date === "string" && r.date) {
        return { ...r, date: validateAndFixDate(r.date) };
      }
      return r;
    });
  }

  return result;
}

function getModulePrompt(slug: string, examName: string, year: number, ctx: ModuleAIContext, rawContent?: string): string | null {
  const { identity, edition } = ctx;
  const shortName = identity.shortName || examName;
  const rawContext = rawContent && rawContent.trim().length > 10
    ? `\n\nRAW DATA (use this to fill in real details):\n---\n${rawContent.slice(0, 6000)}\n---\n`
    : "";

  switch (slug) {
    case "overview":
      return `Generate a comprehensive overview for "${examName}" (${shortName}) ${year}. Conducting body: ${identity.conductingBody}.${rawContext}Return a JSON object: {"summary": "1-2 line summary", "body": "<html content with h3 headings, paragraphs, bullet points covering what the exam is, who conducts it, what it's for, key highlights>"}. Use REAL data from the raw content if provided. Return only valid JSON.`;

    case "eligibility":
      return `Generate detailed eligibility criteria for "${examName}" ${year}.${rawContext}Return JSON: {"qualification": "educational qualification details", "ageLimit": "age limit details or No age limit", "nationality": "nationality requirements", "attempts": "number of attempts allowed", "additionalCriteria": "<html with any other eligibility details, relaxations for categories, etc>"}. Use REAL data from raw content if provided. Return only valid JSON.`;

    case "application-process":
      return `Generate a step-by-step application process for "${examName}" ${year}. Official website: ${identity.officialWebsite || "N/A"}.${rawContext}Return JSON: {"description": "<html overview of the process>", "steps": [{"title": "Step title", "description": "Detailed step description"}], "applyLink": "${identity.officialWebsite || ""}", "fee": "<html with fee structure: General, OBC, SC/ST, payment modes>"}. Include 5-7 detailed steps using REAL process from raw data if provided. Return only valid JSON.`;

    case "exam-pattern":
      return `Generate exam pattern details for "${examName}" ${year}.${rawContext}Return JSON: {"mode": "Online CBT or Offline or both", "duration": "total duration", "totalMarks": number, "markingScheme": "+X/-Y or no negative marking", "sections": [{"name": "Section Name", "questions": number, "marks": number, "duration": "section duration"}], "notes": "<html with additional notes about exam pattern, question types, etc>"}. Use REAL data from raw content if provided. Return only valid JSON.`;

    case "syllabus":
      return `Generate subject-wise syllabus for "${examName}" ${year}.${rawContext}Return JSON: {"subjects": [{"name": "Subject/Section Name", "topics": "<html with bullet list of topics>"}], "downloadLink": "", "notes": "<html with preparation tips>"}. Include all major subjects. Use REAL data from raw content if provided. Return only valid JSON.`;

    case "admit-card":
      return `Generate admit card information for "${examName}" ${year}.${rawContext}${INDIAN_DATE_PROMPT_SHORT}\nReturn JSON: {"releaseDate": "YYYY-MM-DD or empty", "downloadLink": "${identity.officialWebsite || ""}", "body": "<html with how to download admit card, steps, what details to check, what to bring to exam center>", "documents": "List of documents candidates must bring"}. Use REAL data from raw content if provided. Return only valid JSON.`;

    case "result":
      return `Generate result information for "${examName}" ${year}.${rawContext}${INDIAN_DATE_PROMPT_SHORT}\nReturn JSON: {"declarationDate": "YYYY-MM-DD or empty", "checkLink": "${identity.officialWebsite || ""}", "body": "<html with how to check result, what the scorecard contains, next steps after result>", "statistics": "Expected statistics like total appeared, qualified, etc."}. Use REAL data from raw content if provided. Return only valid JSON.`;

    case "cut-off":
      return `Generate cutoff information for "${examName}" ${year}.${rawContext}Return JSON: {"body": "<html with explanation of cutoff, factors affecting cutoff, previous year trends>", "categories": [{"category": "General", "cutoff": "Expected score", "year": "${year - 1}"}], "notes": "<html with tips about cutoff, what happens after cutoff>"}. Include General, OBC, SC, ST, EWS categories. Use REAL data from raw content if provided. Return only valid JSON.`;

    case "counselling":
      return `Generate counselling process information for "${examName}" ${year}.${rawContext}Return JSON: {"body": "<html with counselling process overview, who is eligible, what happens>", "officialLink": "${identity.officialWebsite || ""}", "rounds": [{"name": "Round 1", "date": "", "description": "First round of seat allocation"}], "documents": "<html with list of required documents for counselling>"}. Use REAL data from raw content if provided. Return only valid JSON.`;

    default:
      return null;
  }
}
