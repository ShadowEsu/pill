// Vercel function: POST /api/assist-tip {mode, bigText, route, screenContext} → one proactive sentence for the screen
// (Gemini, clause-filtered, cached in memory 60 s per route + context). Same code the local service mounts.
import { endpoint } from './_lib/http.js';
import { tipRoute } from './_lib/follower.js';

export default endpoint('assist-tip', tipRoute);
