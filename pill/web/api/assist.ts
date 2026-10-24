// Vercel function: POST /api/assist {message, mode, bigText, route, screenContext, history?} → SSE stream from Gemini
// (delta… → replace? → done). Same code the local service mounts at /api/assist.
import { assistHandler } from './_lib/follower.js';

export default assistHandler();
