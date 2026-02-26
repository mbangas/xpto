const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const DATA_DIR = path.join(__dirname, 'JSON-DATA');
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

function ensureDataDir(){ if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }
function keyToFilename(key){ return encodeURIComponent(key) + '.json'; }

app.get('/api/data', (req, res) => {
  ensureDataDir();
  try{
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    const keys = files.map(f => decodeURIComponent(f.replace(/\.json$/,'')));
    res.json({ keys });
  }catch(e){ res.status(500).json({ error: String(e) }); }
});

app.get('/api/data/:key', (req, res) => {
  ensureDataDir();
  const key = req.params.key;
  const fname = path.join(DATA_DIR, keyToFilename(key));
  if(!fs.existsSync(fname)) return res.status(404).json({ error: 'not found' });
  try{
    const raw = fs.readFileSync(fname, 'utf8');
    const parsed = JSON.parse(raw);
    res.json({ data: parsed });
  }catch(e){ res.status(500).json({ error: String(e) }); }
});

app.post('/api/data/:key', (req, res) => {
  ensureDataDir();
  const key = req.params.key;
  const fname = path.join(DATA_DIR, keyToFilename(key));
  try{
    const body = req.body;
    fs.writeFileSync(fname, JSON.stringify(body, null, 2), 'utf8');
    res.json({ ok: true });
  }catch(e){ res.status(500).json({ error: String(e) }); }
});

app.delete('/api/data/:key', (req, res) => {
  ensureDataDir();
  const key = req.params.key;
  const fname = path.join(DATA_DIR, keyToFilename(key));
  try{
    if(fs.existsSync(fname)) fs.unlinkSync(fname);
    res.json({ ok: true });
  }catch(e){ res.status(500).json({ error: String(e) }); }
});

app.listen(PORT, () => { console.log(`Server running on http://localhost:${PORT}`); });
