const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 8080;
const API_PREFIX = '/fusion-api';
const ENGINE_TAG = 'TurnCloud AI OS:Banana Split';
const MODEL_ID = process.env.MODEL_ID || 'gemini-3-pro-image-preview';

app.set('trust proxy', true);
app.use(bodyParser.json({ limit: '50mb' }));

// CORS（同源時其實不需要，留著保險）
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// 路徑
const PUBLIC_DIR = path.join(__dirname, 'public');
const ASSET_DIR = path.join(PUBLIC_DIR, 'assets');
// Cloud Run 容器內檔案系統可寫，但每次新 instance 都會重置；放在 /tmp 既快又乾淨
const GENERATED_DIR = '/tmp/peigo-generated';
if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
}
const KEEP_GENERATED = 50;
function pruneGeneratedDir() {
    try {
        const files = fs.readdirSync(GENERATED_DIR)
            .filter(f => f.startsWith('peigo-') && f.endsWith('.jpg'))
            .map(f => ({ name: f, mtime: fs.statSync(path.join(GENERATED_DIR, f)).mtimeMs }))
            .sort((a, b) => b.mtime - a.mtime);
        files.slice(KEEP_GENERATED).forEach(f => {
            try { fs.unlinkSync(path.join(GENERATED_DIR, f.name)); } catch (_) {}
        });
    } catch (_) {}
}

// healthcheck
app.get('/healthz', (req, res) => res.json({ ok: true, tag: ENGINE_TAG }));

// 靜態前端
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
// 生成圖以 /generated/<file>.jpg 對外公開
app.use('/generated', express.static(GENERATED_DIR, {
    maxAge: '1h',
    setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=3600, immutable')
}));

// 以 key 對應素材（中/日文版的塔羅名稱不同）；保留中文名稱作為舊版相容
const TAROT_ASSETS = {
    sun: 'peigo-smoothie-01.jpg',
    star: 'peigo-smoothie-02.jpg',
    wheel: 'peigo-smoothie-03.jpg',
    strength: 'peigo-smoothie-04.jpg',
    '太陽': 'peigo-smoothie-01.jpg',
    '星星': 'peigo-smoothie-02.jpg',
    '命運之輪': 'peigo-smoothie-03.jpg',
    '力量': 'peigo-smoothie-04.jpg'
};
const MIME_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
};

function readInlineAsset(fileName) {
    const assetPath = path.join(ASSET_DIR, fileName);
    const ext = path.extname(fileName).toLowerCase();
    return {
        mimeType: MIME_TYPES[ext] || 'application/octet-stream',
        data: fs.readFileSync(assetPath).toString('base64')
    };
}

app.post(`${API_PREFIX}/fuse`, async (req, res) => {
    try {
        const { image, tarot } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!image || !tarot) throw new Error('Missing image or tarot');
        if (!apiKey) throw new Error('Image engine credential not configured');

        const userBase64 = image.split(',')[1];
        const turncloudLogo = readInlineAsset('turncloud-logo.png');
        const peigoLogo = readInlineAsset('peigo-logo.jpg');
        const accucrazyLogo = readInlineAsset('accucrazy-logo.webp');
        const selectedTarot = readInlineAsset(TAROT_ASSETS[tarot.key] || TAROT_ASSETS[tarot.name] || TAROT_ASSETS.sun);
        const mascot = readInlineAsset('go-mascot.jpg');

        const prompt = `${ENGINE_TAG} – Peigo Smart Smoothie campaign poster.

        Produce a single finished 9:16 vertical poster (1080x1920) for the "TurnCloud × Peigo" smart smoothie experience. Style: premium 3D render, glossy collectible-toy aesthetic, cinematic lighting, soft bokeh, subtle confetti / fresh-fruit splash particles. Use the Peigo brand palette (signature green #0f8a5f, warm yellow, fresh-fruit accents). Clean, modern, healthy-lifestyle look – like a flagship Peigo Smoothie pop-up booth.

        Compose the poster using the following inputs:
        1. FIRST image (user selfie) → stylize the person into a cute 3D collectible-toy character, preserving their face, hairstyle and outfit colors. Place them as the hero of the scene.
        2. SECOND image (TurnCloud logo) → render as a glowing cyan signage, holographic panel or interactive smart-booth UI inside the scene. Keep proportions and colors accurate.
        3. THIRD image (Peigo logo) → use as the main brand sign of the booth.
        4. FOURTH image (Accucrazy logo) → place as a small, subtle "Powered by" credit badge near the counter or footer.
        5. FIFTH image (Peigo smoothie poster) → use as the hero product visual (a large product display / poster next to the character). Keep the smoothie cup illustration recognizable.
        6. SIXTH image (green Peigo cup mascot) → place next to the user character, interacting playfully (high-five, sharing a smoothie, etc.).

        Theme keyword: "${tarot.name}" (${tarot.flavor || ''} — ${tarot.meaning || ''}).

        Hard constraints: DO NOT include any 7-Eleven, convenience-store, or other competing brand elements. DO NOT add text watermarks, captions, model names, or AI tool branding. Output ONLY one finished poster image.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{
                parts: [
                    { text: prompt + ' OUTPUT_ONLY_ONE_IMAGE_NOT_TEXT.' },
                    { inlineData: { mimeType: 'image/jpeg', data: userBase64 } },
                    { inlineData: turncloudLogo },
                    { inlineData: peigoLogo },
                    { inlineData: accucrazyLogo },
                    { inlineData: selectedTarot },
                    { inlineData: mascot }
                ]
            }],
            generationConfig: { responseModalities: ['IMAGE'] }
        };

        console.log(`[${ENGINE_TAG}] Generating poster for "${tarot.name}"...`);
        const response = await axios.post(url, payload, { timeout: 90000 });

        if (!response.data.candidates || !response.data.candidates[0]) {
            console.error(`[${ENGINE_TAG}] No candidates returned`);
            throw new Error('No candidates in engine response');
        }
        const part = response.data.candidates[0].content.parts.find(p => p.inlineData);
        if (!part) {
            console.error(`[${ENGINE_TAG}] No image in response parts`);
            throw new Error('No image generated');
        }

        const generatedBase64 = part.inlineData.data;
        const buffer = Buffer.from(generatedBase64, 'base64');
        const fileName = `peigo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const filePath = path.join(GENERATED_DIR, fileName);
        fs.writeFileSync(filePath, buffer);
        const fusedUrl = `/generated/${fileName}`;
        const downloadUrl = new URL(fusedUrl, `${req.protocol}://${req.get('host')}`).href;
        const qrImage = await QRCode.toDataURL(downloadUrl, {
            width: 256,
            margin: 1,
            color: {
                dark: '#0a6b48',
                light: '#ffffff'
            }
        });
        console.log(`[${ENGINE_TAG}] Poster generated (${buffer.length} bytes) -> ${fusedUrl}`);
        res.json({ fusedImage: fusedUrl, downloadUrl, qrImage, fusedSize: buffer.length });
        pruneGeneratedDir();

    } catch (error) {
        if (error.response) {
            console.error(`[${ENGINE_TAG}] Engine response error:`, JSON.stringify(error.response.data).slice(0, 500));
        }
        console.error(`[${ENGINE_TAG}] Error:`, error.message);
        res.status(500).json({ error: 'Generation failed', details: error.message });
    }
});

// ── 留資：名字 + email → Google Apps Script（寫入 Google Sheet 並寄送資料）
const LEAD_WEBHOOK_URL = process.env.LEAD_WEBHOOK_URL;
const LEAD_WEBHOOK_SECRET = process.env.LEAD_WEBHOOK_SECRET;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEAD_LIMIT = 5;                    // 同一 IP 每 10 分鐘最多 5 次，避免被拿來亂寄信
const LEAD_WINDOW_MS = 10 * 60 * 1000;
const leadHits = new Map();

function allowLead(ip) {
    const now = Date.now();
    const hits = (leadHits.get(ip) || []).filter(t => now - t < LEAD_WINDOW_MS);
    if (hits.length >= LEAD_LIMIT) {
        leadHits.set(ip, hits);
        return false;
    }
    hits.push(now);
    leadHits.set(ip, hits);
    if (leadHits.size > 5000) leadHits.clear();
    return true;
}

app.post('/api/lead', async (req, res) => {
    const name = String(req.body?.name || '').trim().slice(0, 40);
    const email = String(req.body?.email || '').trim().slice(0, 120);
    const lang = req.body?.lang === 'ja' ? 'ja' : 'zh';
    const tarot = String(req.body?.tarot || '').slice(0, 20);

    if (!name || !EMAIL_RE.test(email) || req.body?.consent !== true) {
        return res.status(400).json({ error: 'Invalid lead' });
    }
    if (!allowLead(req.ip)) {
        return res.status(429).json({ error: 'Too many requests' });
    }
    if (!LEAD_WEBHOOK_URL || !LEAD_WEBHOOK_SECRET) {
        console.error('[lead] LEAD_WEBHOOK_URL / LEAD_WEBHOOK_SECRET not configured');
        return res.status(503).json({ error: 'Lead capture not configured' });
    }

    try {
        // Apps Script 執行完 doPost 會 302 轉到 googleusercontent 取結果；
        // axios 自動跟轉址會帶著 POST 內容而拿到 404，所以手動用 GET 跟一次
        let response = await axios.post(LEAD_WEBHOOK_URL, {
            secret: LEAD_WEBHOOK_SECRET,
            name,
            email,
            lang,
            tarot
        }, {
            timeout: 60000,
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400
        });
        if (response.status >= 300 && response.headers.location) {
            response = await axios.get(response.headers.location, { timeout: 30000 });
        }
        // 偶爾 Google 會把 JSON 包在一頁 HTML 裡回傳，這時從內文把結果抓出來
        if (typeof response.data === 'string') {
            const match = response.data.match(/\{"ok":(?:true|false)[^{}]*\}/);
            response.data = match ? JSON.parse(match[0]) : null;
        }
        if (!response.data || response.data.ok !== true) {
            throw new Error(`Webhook replied ${JSON.stringify(response.data).slice(0, 200)}`);
        }
        console.log(`[lead] saved + mailed (${lang}, ${tarot})`);
        res.json({ ok: true });
    } catch (error) {
        console.error('[lead] Error:', error.message);
        res.status(502).json({ error: 'Lead delivery failed' });
    }
});

app.listen(PORT, () => {
    console.log(`${ENGINE_TAG} – Peigo Smoothie Poster Service ready on port ${PORT}.`);
});
