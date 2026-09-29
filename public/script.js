/* =========================================================
   Peigo × TurnCloud Smoothie Tarot – Frontend
   Steps: 1) 拍照 → 2) 選果昔塔羅 → loading → 3) 結果
   ========================================================= */

const LANG = (document.documentElement.lang || 'zh-TW').toLowerCase().startsWith('ja') ? 'ja' : 'zh';

const I18N = {
    zh: {
        cameraError: '無法啟動相機，請允許瀏覽器使用相機權限。',
        preparing: '準備相機中…',
        countdown: (n) => `${n} 秒後自動拍照`,
        capturing: '拍照中…',
        resultReady: '掃描下方 QR Code 即可下載原圖',
        engineBusy: (msg) => `引擎暫時忙線（${msg}），先給你一張預覽版，再點一次就會重試。`,
        imageLoadFailed: (src) => `生成圖載入失敗：${src}`,
        overlayTitle: (name) => `今日塔羅：${name}`,
        fortuneTitle: (card) => `${card.name}｜${card.meaning}`,
        resultTitle: (name) => [`${name} 的`, '專屬果昔運勢', ''],
        font: "'Noto Sans TC', Arial"
    },
    ja: {
        cameraError: 'カメラを起動できません。ブラウザでカメラへのアクセスを許可してください。',
        preparing: 'カメラを準備中…',
        countdown: (n) => `${n} 秒後に自動撮影`,
        capturing: '撮影中…',
        resultReady: '下の QR コードを読み取ると元画像をダウンロードできます',
        engineBusy: (msg) => `エンジンが混み合っています（${msg}）。まずはプレビュー版をどうぞ。もう一度タップすると再試行します。`,
        imageLoadFailed: (src) => `生成画像の読み込みに失敗しました：${src}`,
        overlayTitle: (name) => `今日のタロット：${name}`,
        fortuneTitle: (card) => `${card.name}｜${card.meaning}`,
        resultTitle: (name) => [`${name} さんだけの`, 'スムージー占い', ''],
        leadInvalidName: 'お名前を入力してください。',
        leadInvalidEmail: 'メールアドレスの形式をご確認ください。',
        leadNeedConsent: '同意にチェックを入れてください。',
        leadSending: '送信中…',
        leadSent: (email) => `登録ありがとうございます！${email} に資料をお送りしました。`,
        leadSentWaiting: 'ポスターはもうすぐ完成します…',
        leadFailed: '送信できませんでした。お手数ですが、もう一度お試しください。',
        font: "'Noto Sans JP', 'Noto Sans TC', Arial"
    }
};
const T = I18N[LANG];

const TAROT_CARDS = {
    zh: [
        {
            key: "sun",
            name: "太陽",
            flavor: "芒來百旺",
            meaning: "活力與成功",
            advice: "今天的你光芒四射，來杯 Peigo 芒來百旺果昔，喚醒一整天的好能量！",
            image: "assets/peigo-smoothie-01.jpg"
        },
        {
            key: "star",
            name: "星星",
            flavor: "藍莓香蕉",
            meaning: "希望與靈感",
            advice: "靈感正悄悄醞釀，讓 Peigo 藍莓香蕉為你點亮夜空中最閃的那顆星。",
            image: "assets/peigo-smoothie-02.jpg"
        },
        {
            key: "wheel",
            name: "命運之輪",
            flavor: "羽衣纖橙",
            meaning: "轉機與運氣",
            advice: "命運齒輪正在轉動，羽衣纖橙果昔幫你穩穩接住每一個新機會。",
            image: "assets/peigo-smoothie-03.jpg"
        },
        {
            key: "strength",
            name: "力量",
            flavor: "草莓紅芭樂",
            meaning: "勇氣與自信",
            advice: "相信自己的步伐，一杯 Peigo 草莓紅芭樂，補滿你的內心電量！",
            image: "assets/peigo-smoothie-04.jpg"
        }
    ],
    ja: [
        {
            key: "sun",
            name: "太陽",
            flavor: "マンゴーパッション",
            meaning: "活力と成功",
            advice: "今日のあなたは輝きに満ちています。Peigo マンゴーパッションで一日中エネルギーチャージ！",
            image: "assets/peigo-smoothie-01.jpg"
        },
        {
            key: "star",
            name: "星",
            flavor: "ブルーベリーバナナ",
            meaning: "希望とひらめき",
            advice: "ひらめきが静かに育っています。Peigo ブルーベリーバナナが夜空で一番輝く星を灯します。",
            image: "assets/peigo-smoothie-02.jpg"
        },
        {
            key: "wheel",
            name: "運命の輪",
            flavor: "ケールオレンジ",
            meaning: "転機と幸運",
            advice: "運命の歯車が回り始めました。ケールオレンジで新しいチャンスをしっかりキャッチ。",
            image: "assets/peigo-smoothie-03.jpg"
        },
        {
            key: "strength",
            name: "力",
            flavor: "ストロベリーグァバ",
            meaning: "勇気と自信",
            advice: "自分の歩みを信じて。Peigo ストロベリーグァバで心のバッテリーをフル充電！",
            image: "assets/peigo-smoothie-04.jpg"
        }
    ]
};
const tarotCards = TAROT_CARDS[LANG];

let capturedImage = null;
let selectedTarot = null;
let cameraStream = null;
let countdownTimer = null;
let countdownRemaining = 5;
let hasAutoCaptured = false;
let currentDownloadUrl = null;
let resultReady = false;
let leadName = '';
let leadSubmitted = false;

const $ = (sel) => document.querySelector(sel);

/* ── Fusion API 位址自動偵測 ───────────────
   - Cloud Run / 18777 / 其他同源部署：相對路徑
   - 本機 18800 純靜態 server：跨 port 打 localhost:18777
   ----------------------------------------- */
const FUSION_API_URL = (() => {
    if (typeof window === 'undefined') return '/fusion-api/fuse';
    if (window.location.port === '18800') {
        return `${window.location.protocol}//${window.location.hostname}:18777/fusion-api/fuse`;
    }
    return '/fusion-api/fuse';
})();

function showStep(id) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── 啟動：自動開鏡頭 ───────────────────── */
async function startCamera() {
    const video = $('#video');
    try {
        resetCaptureCountdown();
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1440 } },
            audio: false
        });
        video.srcObject = cameraStream;
        await new Promise((resolve) => {
            if (video.readyState >= 2 && video.videoWidth) return resolve();
            video.onloadedmetadata = () => resolve();
        });
        startCaptureCountdown(5);
    } catch (err) {
        console.error('無法啟動相機:', err);
        alert(T.cameraError);
    }
}

function resetCaptureCountdown() {
    clearInterval(countdownTimer);
    countdownTimer = null;
    countdownRemaining = 5;
    hasAutoCaptured = false;
    const overlay = $('#countdownOverlay');
    const number = $('#countdownNumber');
    const shutterButton = $('#shutterButton');
    const shutterText = $('#shutterText');
    if (overlay) overlay.hidden = true;
    if (number) number.textContent = '5';
    if (shutterButton) shutterButton.disabled = true;
    if (shutterText) shutterText.textContent = T.preparing;
}

function startCaptureCountdown(seconds = 5) {
    clearInterval(countdownTimer);
    countdownRemaining = seconds;
    const overlay = $('#countdownOverlay');
    const number = $('#countdownNumber');
    const shutterText = $('#shutterText');
    if (overlay) overlay.hidden = false;

    const render = () => {
        if (number) number.textContent = String(countdownRemaining);
        if (shutterText) shutterText.textContent = T.countdown(countdownRemaining);
    };

    render();
    countdownTimer = setInterval(() => {
        countdownRemaining -= 1;
        if (countdownRemaining <= 0) {
            clearInterval(countdownTimer);
            countdownTimer = null;
            if (shutterText) shutterText.textContent = T.capturing;
            takePhoto();
            return;
        }
        render();
    }, 1000);
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
}

/* ── Step 1：拍照 ───────────────────────── */
function takePhoto() {
    if (hasAutoCaptured) return;
    const video = $('#video');
    const canvas = $('#photoCanvas');
    if (!video.videoWidth) {
        startCaptureCountdown(2);
        return;
    }
    hasAutoCaptured = true;
    clearInterval(countdownTimer);
    const overlay = $('#countdownOverlay');
    if (overlay) overlay.hidden = true;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.restore();
    capturedImage = canvas.toDataURL('image/jpeg', 0.92);
    stopCamera();
    showStep('step2');
}

/* ── Step 2：選塔羅 → 呼叫 AI ───────────── */
async function selectTarot(key) {
    selectedTarot = tarotCards.find(t => t.key === key);
    if (!selectedTarot) return;
    resultReady = false;
    const readyBar = $('#resultReadyBar');
    if (readyBar) readyBar.hidden = true;
    showStep('loadingStep');

    try {
        console.log('[TurnCloud AI OS:Banana Split] POST', FUSION_API_URL);
        const response = await fetch(FUSION_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: capturedImage, tarot: selectedTarot, lang: LANG })
        });
        if (!response.ok) {
            const txt = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status} ${txt.slice(0, 200)}`);
        }
        const data = await response.json();
        if (!data.fusedImage) throw new Error('Engine returned no image');
        await displayFusedResult(data.fusedImage);
        renderDownloadQr(data.downloadUrl || currentDownloadUrl, data.qrImage);
        const subtitle = document.getElementById('resultSubtitle');
        if (subtitle) {
            subtitle.textContent = T.resultReady;
            subtitle.style.color = '';
        }
        onResultReady();
    } catch (err) {
        console.error('[TurnCloud AI OS:Banana Split] Fallback to local canvas:', err);
        await generateFinalResult();
        const subtitle = document.getElementById('resultSubtitle');
        if (subtitle) {
            subtitle.textContent = T.engineBusy(err.message || err);
            subtitle.style.color = '#c0392b';
        }
        onResultReady();
    }
}

/* ── 生成完成：填寫中就不打斷，改顯示「看結果」按鈕 ── */
function isFillingLeadForm() {
    const form = $('#leadForm');
    if (!form || leadSubmitted) return false;
    const typed = ['#leadName', '#leadEmail'].some(sel => $(sel) && $(sel).value.trim());
    return typed || form.contains(document.activeElement);
}

function onResultReady() {
    resultReady = true;
    if (isFillingLeadForm()) {
        const readyBar = $('#resultReadyBar');
        if (readyBar) readyBar.hidden = false;
        return;
    }
    goToResult();
}

function goToResult() {
    renderResultText();
    celebrate();
    showStep('step3');
}

function renderResultText() {
    const title = $('#resultTitle');
    if (title && leadName) {
        const [before, em, after] = T.resultTitle(leadName);
        const emEl = document.createElement('em');
        emEl.textContent = em;
        title.replaceChildren(before, emEl, after);
    }
    const card = $('#fortuneCard');
    if (card && selectedTarot) {
        $('#fortuneTitle').textContent = T.fortuneTitle(selectedTarot);
        $('#fortuneAdvice').textContent = selectedTarot.advice;
        card.hidden = false;
    }
}

/* ── 留資表單（日文版）：名字顯示在結果頁、資料寄到信箱 ── */
function setLeadStatus(text, isError = false) {
    const status = $('#leadStatus');
    if (!status) return;
    status.textContent = text;
    status.classList.toggle('is-error', isError);
}

async function submitLead(event) {
    event.preventDefault();
    const name = $('#leadName').value.trim();
    const email = $('#leadEmail').value.trim();
    if (!name) return setLeadStatus(T.leadInvalidName, true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setLeadStatus(T.leadInvalidEmail, true);
    if (!$('#leadConsent').checked) return setLeadStatus(T.leadNeedConsent, true);

    const button = $('#leadSubmit');
    button.disabled = true;
    setLeadStatus(T.leadSending);
    try {
        const response = await fetch('/api/lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                email,
                consent: true,
                lang: LANG,
                tarot: selectedTarot ? selectedTarot.key : ''
            })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        leadName = name;
        leadSubmitted = true;
        $('#leadForm').querySelectorAll('input').forEach(input => { input.disabled = true; });
        setLeadStatus(`${T.leadSent(email)}${resultReady ? '' : ` ${T.leadSentWaiting}`}`);
        if (resultReady) setTimeout(goToResult, 1600);
    } catch (err) {
        console.error('Lead submit failed:', err);
        button.disabled = false;
        setLeadStatus(T.leadFailed, true);
    }
}

/* ── 顯示 AI 融合結果 ───────────────────── */
function resolveImageUrl(src) {
    if (!src) return '';
    if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) return src;
    if (src.startsWith('/')) return src;
    return `/${src}`;
}

function displayFusedResult(imageSrc) {
    return new Promise((resolve, reject) => {
        const canvas = $('#resultCanvas');
        const ctx = canvas.getContext('2d');
        const resultImage = $('#resultImage');
        canvas.width = 1080;
        canvas.height = 1920;
        const resolvedSrc = resolveImageUrl(imageSrc);
        currentDownloadUrl = new URL(resolvedSrc, window.location.origin).href;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (resultImage) {
                resultImage.src = resolvedSrc;
                resultImage.hidden = false;
            }
            ctx.drawImage(img, 0, 0, 1080, 1920);
            drawResultOverlay(ctx);
            resolve();
        };
        img.onerror = () => reject(new Error(T.imageLoadFailed(resolvedSrc)));
        img.src = resolvedSrc;
    });
}

function renderDownloadQr(url, qrImage) {
    const card = $('#downloadQrCard');
    const image = $('#downloadQrImage');
    if (!card || !image || !url) return;
    card.hidden = false;
    image.src = qrImage || `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`;
    image.onerror = () => {
        console.error('QR Code 載入失敗:', image.src);
        card.hidden = true;
    };
}

/* ── Fallback：本地 Canvas 合成 ──────────── */
async function generateFinalResult() {
    const canvas = $('#resultCanvas');
    const ctx = canvas.getContext('2d');
    const resultImage = $('#resultImage');
    currentDownloadUrl = null;
    if (resultImage) {
        resultImage.hidden = true;
        resultImage.removeAttribute('src');
    }
    const qrCard = $('#downloadQrCard');
    if (qrCard) qrCard.hidden = true;
    const qrImage = $('#downloadQrImage');
    if (qrImage) qrImage.removeAttribute('src');
    canvas.width = 1080;
    canvas.height = 1920;

    const grad = ctx.createLinearGradient(0, 0, 0, 1920);
    grad.addColorStop(0, '#0f8a5f');
    grad.addColorStop(0.55, '#18b07e');
    grad.addColorStop(1, '#fff2c2');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    const peigoLogo = await loadImage('assets/peigo-logo.jpg');
    drawRoundedImage(ctx, peigoLogo, 440, 70, 200, 200, 100);

    if (capturedImage) {
        const userImg = await loadImage(capturedImage);
        drawRoundedImage(ctx, userImg, 140, 320, 800, 800, 40);
    }

    const tarotImage = await loadImage(selectedTarot.image);
    drawRoundedImage(ctx, tarotImage, 90, 1200, 360, 480, 30);

    const mascot = await loadImage('assets/go-mascot.jpg');
    drawRoundedImage(ctx, mascot, 600, 1280, 420, 420, 80);

    drawResultOverlay(ctx);
}

function drawResultOverlay(ctx) {
    ctx.save();
    const overlayGrad = ctx.createLinearGradient(0, 1500, 0, 1920);
    overlayGrad.addColorStop(0, 'rgba(15, 26, 20, 0)');
    overlayGrad.addColorStop(0.4, 'rgba(15, 26, 20, 0.55)');
    overlayGrad.addColorStop(1, 'rgba(15, 26, 20, 0.85)');
    ctx.fillStyle = overlayGrad;
    ctx.fillRect(0, 1500, 1080, 420);

    ctx.fillStyle = '#ffd84d';
    ctx.font = `bold 60px ${T.font}`;
    ctx.textAlign = 'center';
    ctx.fillText(T.overlayTitle(selectedTarot.name), 540, 1620);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 44px ${T.font}`;
    ctx.fillText(`${selectedTarot.flavor} ・ ${selectedTarot.meaning}`, 540, 1680);

    ctx.font = `32px ${T.font}`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    wrapText(ctx, selectedTarot.advice, 540, 1740, 940, 42);

    ctx.font = "600 28px 'Poppins', 'Noto Sans TC', Arial";
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText("Powered by TurnCloud × Accucrazy", 540, 1880);
    ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const chars = text.split('');
    let line = '';
    let lines = [];
    chars.forEach(ch => {
        const test = line + ch;
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = ch;
        } else {
            line = test;
        }
    });
    if (line) lines.push(line);
    lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
}

function drawRoundedImage(ctx, img, x, y, w, h, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/* ── 慶祝 confetti ─────────────────────── */
function celebrate() {
    if (typeof confetti !== 'function') return;
    confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.4 },
        colors: ['#0f8a5f', '#ffd84d', '#ff8c42', '#ffb3c1']
    });
}

/* ── 下載分享圖 ─────────────────────────── */
function downloadImage() {
    if (currentDownloadUrl) {
        const link = document.createElement('a');
        link.download = `peigo-tarot-${selectedTarot ? selectedTarot.key : 'result'}.jpg`;
        link.href = currentDownloadUrl;
        link.click();
        return;
    }
    const canvas = $('#resultCanvas');
    const link = document.createElement('a');
    link.download = `peigo-tarot-${selectedTarot ? selectedTarot.key : 'result'}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
}

/* ── 入口 ───────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
    const leadForm = $('#leadForm');
    if (leadForm) leadForm.addEventListener('submit', submitLead);
    startCamera();
});
