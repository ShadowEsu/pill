// Gemini vision label read: five fields from one photo, or {mode:'unavailable'}. The image is only held for the call.
import { GEMINI_CHECKER_MODEL, GeminiError, geminiAvailable, geminiGenerate, imagePart } from './gemini.js';

export interface LabelFields { drug: string | null; strength: string | null; lot: string | null; maker: string | null; expiry: string | null; confidence: number }
export type LabelRead = (LabelFields & { model: 'gemini'; model_id: string; mode: 'live'; ms: number }) | { mode: 'unavailable'; error: string };

const LABEL_PROMPT = [
  'You read a medicine bottle label from a photo for a pharmacy intake form.',
  'Return JSON only: {"drug": string|null, "strength": string|null, "lot": string|null, "maker": string|null, "expiry": string|null, "confidence": number}.',
  'drug: the active ingredient name in Title Case (e.g. "Riboflavin"). strength: amount with unit (e.g. "100 mg"). lot: the lot or batch code exactly as printed. maker: the brand or manufacturer. expiry: YYYY-MM.',
  'Copy only what is printed and legible. If a field is not visible or you are unsure, use null. Never guess or fill in a likely value.',
  'confidence: 0 to 1, how sure you are that every non-null field is read correctly.',
].join('\n');

const field = (v: unknown) => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim().slice(0, 80) : null);

/** Image reading uses GEMINI_CHECKER_MODEL (then the fallback chain). */
export async function readLabel(image: unknown, timeoutMs = 30_000): Promise<LabelRead> {
  if (!geminiAvailable()) return { mode: 'unavailable', error: 'no GEMINI_API_KEY on the service' };
  const img = imagePart(image);
  if (!img) return { mode: 'unavailable', error: 'send {"image": "data:image/png|jpeg|webp;base64,…"}' };
  try {
    const r = await geminiGenerate({ parts: [{ text: LABEL_PROMPT }, img], json: true, model: GEMINI_CHECKER_MODEL, timeoutMs });
    const o = r.json;
    if (!o) return { mode: 'unavailable', error: 'gemini reply was not JSON' };
    const conf = typeof o.confidence === 'number' && Number.isFinite(o.confidence) ? o.confidence : 0;
    return {
      drug: field(o.drug), strength: field(o.strength), lot: field(o.lot), maker: field(o.maker), expiry: field(o.expiry),
      confidence: Math.max(0, Math.min(1, conf)), model: 'gemini', model_id: r.model, mode: 'live', ms: r.ms,
    };
  } catch (e) {
    return { mode: 'unavailable', error: e instanceof GeminiError ? e.message : (e as Error).message };
  }
}

/** POST /api/label body {image} → the read (200 even when unavailable, like the original /label). */
export const labelRoute = async (body: Record<string, unknown>) => ({ body: await readLabel(body.image) });
