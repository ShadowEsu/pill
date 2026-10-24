// Vercel function: POST /api/check → the Gemini checker's full step log and report (no streaming). Same code the local
// service mounts. The sensor verdict in the request is returned unchanged.
import { endpoint } from './_lib/http.js';
import { checkRoute } from './_lib/checker.js';

export default endpoint('check', checkRoute);
