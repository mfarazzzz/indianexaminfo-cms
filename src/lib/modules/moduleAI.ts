/**
 * moduleAI.ts — AI content generation scoped to individual modules.
 *
 * Generates focused content for a specific module type using the exam context.
 */
import { generateWithGemini } from "@/lib/gemini/client";
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
  model?: string
): Promise<Record<string, unknown>> {
  const prompt = getModulePrompt(moduleSlug, examName, year, context);
  if (!prompt) throw new Error(`No AI prompt defined for module: ${moduleSlug}`);

  const raw = await generateWithGemini(prompt, apiKey, model);

  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // If not JSON, treat as HTML body
    return { body: cleaned };
  }
}

function getModulePrompt(slug: string, examName: string, year: number, ctx: ModuleAIContext): string | null {
  const { identity, edition } = ctx;
  const shortName = identity.shortName || examName;

  switch (slug) {
    case "overview":
      return `Generate a comprehensive overview for "${examName}" (${shortName}) ${year}. Conducting body: ${identity.conductingBody}. Return a JSON object: {"summary": "1-2 line summary", "body": "<html content with h3 headings, paragraphs, bullet points covering what the exam is, who conducts it, what it's for, key highlights>"}. Return only valid JSON.`;

    case "eligibility":
      return `Generate detailed eligibility criteria for "${examName}" ${year}. Return JSON: {"qualification": "educational qualification details", "ageLimit": "age limit details or No age limit", "nationality": "nationality requirements", "attempts": "number of attempts allowed", "additionalCriteria": "<html with any other eligibility details, relaxations for categories, etc>"}. Use real data if known. Return only valid JSON.`;

    case "application-process":
      return `Generate a step-by-step application process for "${examName}" ${year}. Official website: ${identity.officialWebsite || "N/A"}. Return JSON: {"description": "<html overview of the process>", "steps": [{"title": "Step title", "description": "Detailed step description"}], "applyLink": "${identity.officialWebsite || ""}", "fee": "<html with fee structure: General, OBC, SC/ST, payment modes>"}. Include 5-7 detailed steps. Return only valid JSON.`;

    case "exam-pattern":
      return `Generate exam pattern details for "${examName}" ${year}. Return JSON: {"mode": "Online CBT or Offline or both", "duration": "total duration", "totalMarks": number, "markingScheme": "+X/-Y or no negative marking", "sections": [{"name": "Section Name", "questions": number, "marks": number, "duration": "section duration"}], "notes": "<html with additional notes about exam pattern, question types, etc>"}. Use real data if known. Return only valid JSON.`;

    case "syllabus":
      return `Generate subject-wise syllabus for "${examName}" ${year}. Return JSON: {"subjects": [{"name": "Subject/Section Name", "topics": "<html with bullet list of topics>"}], "downloadLink": "", "notes": "<html with preparation tips>"}. Include all major subjects. Return only valid JSON.`;

    case "admit-card":
      return `Generate admit card information for "${examName}" ${year}. Return JSON: {"releaseDate": "", "downloadLink": "${identity.officialWebsite || ""}", "body": "<html with how to download admit card, steps, what details to check, what to bring to exam center>", "documents": "List of documents candidates must bring"}. Return only valid JSON.`;

    case "result":
      return `Generate result information for "${examName}" ${year}. Return JSON: {"declarationDate": "", "checkLink": "${identity.officialWebsite || ""}", "body": "<html with how to check result, what the scorecard contains, next steps after result>", "statistics": "Expected statistics like total appeared, qualified, etc."}. Return only valid JSON.`;

    case "cut-off":
      return `Generate cutoff information for "${examName}" ${year}. Return JSON: {"body": "<html with explanation of cutoff, factors affecting cutoff, previous year trends>", "categories": [{"category": "General", "cutoff": "Expected score", "year": "${year - 1}"}], "notes": "<html with tips about cutoff, what happens after cutoff>"}. Include General, OBC, SC, ST, EWS categories. Return only valid JSON.`;

    case "counselling":
      return `Generate counselling process information for "${examName}" ${year}. Return JSON: {"body": "<html with counselling process overview, who is eligible, what happens>", "officialLink": "${identity.officialWebsite || ""}", "rounds": [{"name": "Round 1", "date": "", "description": "First round of seat allocation"}], "documents": "<html with list of required documents for counselling>"}. Return only valid JSON.`;

    default:
      return null;
  }
}
