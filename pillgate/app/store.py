"""store.py - tiny JSON-document store on SQLite (stands in for a real database; one file, no setup)."""
import json, os, sqlite3, threading, time, uuid

_LOCK = threading.Lock()


class Store:
    def __init__(self, path):
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.execute("CREATE TABLE IF NOT EXISTS docs (kind TEXT, id TEXT, created REAL, doc TEXT, PRIMARY KEY(kind, id))")
        self.db.commit()

    def new_id(self, prefix):
        return f"{prefix}_{time.strftime('%m%d_%H%M%S')}_{uuid.uuid4().hex[:4]}"

    def put(self, kind, id, doc):
        with _LOCK:
            self.db.execute("INSERT OR REPLACE INTO docs VALUES (?,?,COALESCE((SELECT created FROM docs WHERE kind=? AND id=?),?),?)",
                            (kind, id, kind, id, time.time(), json.dumps(doc)))
            self.db.commit()
        return doc

    def get(self, kind, id):
        with _LOCK:
            r = self.db.execute("SELECT doc FROM docs WHERE kind=? AND id=?", (kind, id)).fetchone()
        return json.loads(r[0]) if r else None

    def update(self, kind, id, **fields):
        with _LOCK:
            r = self.db.execute("SELECT doc FROM docs WHERE kind=? AND id=?", (kind, id)).fetchone()
            doc = json.loads(r[0]) if r else {}
            doc.update(fields)
            self.db.execute("INSERT OR REPLACE INTO docs VALUES (?,?,COALESCE((SELECT created FROM docs WHERE kind=? AND id=?),?),?)",
                            (kind, id, kind, id, time.time(), json.dumps(doc)))
            self.db.commit()
        return doc

    def all(self, kind, limit=500):
        with _LOCK:
            rows = self.db.execute("SELECT id, doc FROM docs WHERE kind=? ORDER BY created DESC LIMIT ?", (kind, limit)).fetchall()
        return [dict(json.loads(d), id=i) for i, d in rows]
