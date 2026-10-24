// Vercel function: POST /api/label {image: data URL} → Gemini label fields. Same code the local service mounts.
import { endpoint } from './_lib/http.js';
import { labelRoute } from './_lib/label.js';

export default endpoint('label', labelRoute);
