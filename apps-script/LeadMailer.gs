/* =========================================================
   Peigo Smoothie Tarot – 留資名單 + 寄送資料（Google Apps Script）
   綁在 Google Sheet 上，部署成「網頁應用程式」後，
   Cloud Run 的 /api/lead 會把 { secret, name, email, lang, tarot } POST 過來：
     1) 寫一列到 Sheet「Leads」分頁
     2) 從部署者的 Google 帳號寄信，附上 Drive 上的資料檔

   指令碼屬性（專案設定 → 指令碼屬性）：
     LEAD_SECRET   必填，與 Cloud Run 的 LEAD_WEBHOOK_SECRET 相同
     DECK_FILE_ID  必填，要附上的 Drive 檔案 ID（網址 /d/<這一段>/view）
     DECK_LABEL    選填，信中資料名稱，預設「会社紹介資料」
     SENDER_NAME   選填，寄件者顯示名稱，預設「TurnCloud × Accucrazy」
     REPLY_TO      選填，回信地址，預設 shelley@accucrazy.com
   ========================================================= */

const SHEET_NAME = 'Leads';
const HEADERS = ['登録日時', 'お名前', 'メールアドレス', '言語', 'タロット', '送信状態'];
const TAROT_LABELS = { sun: '太陽', star: '星', wheel: '運命の輪', strength: '力' };

function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (_) {
    return json_({ ok: false, error: 'bad_json' });
  }
  if (!body.secret || body.secret !== props.getProperty('LEAD_SECRET')) {
    return json_({ ok: false, error: 'unauthorized' });
  }

  const name = String(body.name || '').trim().slice(0, 40);
  const email = String(body.email || '').trim().slice(0, 120);
  const lang = body.lang === 'ja' ? 'ja' : 'zh';
  const tarot = String(body.tarot || '');
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json_({ ok: false, error: 'invalid' });
  }

  const sheet = getSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let row;
  try {
    sheet.appendRow([new Date(), safeCell_(name), safeCell_(email), lang, TAROT_LABELS[tarot] || tarot, '送信中']);
    row = sheet.getLastRow();
  } finally {
    lock.releaseLock();
  }

  try {
    sendDeck_(props, name, email);
    sheet.getRange(row, 6).setValue('送信済み');
    return json_({ ok: true });
  } catch (err) {
    sheet.getRange(row, 6).setValue('エラー: ' + err.message);
    return json_({ ok: false, error: 'mail_failed' });
  }
}

function sendDeck_(props, name, email) {
  const fileId = props.getProperty('DECK_FILE_ID');
  if (!fileId) throw new Error('DECK_FILE_ID not set');
  const deckLabel = props.getProperty('DECK_LABEL') || '会社紹介資料';
  const senderName = props.getProperty('SENDER_NAME') || 'TurnCloud × Accucrazy';
  const replyTo = props.getProperty('REPLY_TO') || 'shelley@accucrazy.com';
  const attachment = DriveApp.getFileById(fileId).getBlob();

  const subject = '【TurnCloud × Accucrazy】' + deckLabel + 'をお送りします';
  const text = [
    name + ' 様',
    '',
    'Peigo スムージータロットにご参加いただき、ありがとうございました。',
    'ご登録のお礼として、TurnCloud × Accucrazy の' + deckLabel + 'を添付にてお送りいたします。',
    '',
    'ご不明な点やご相談がございましたら、本メールにご返信ください。',
    '',
    '――――――――――',
    'Shelley Chen',
    'TurnCloud Japan | Accucrazy',
    'shelley@accucrazy.com'
  ].join('\n');
  const html = text
    .split('\n')
    .map(line => escapeHtml_(line) || '&nbsp;')
    .join('<br>');

  const options = { name: senderName, htmlBody: html, attachments: [attachment] };
  if (replyTo) options.replyTo = replyTo;
  MailApp.sendEmail(email, subject, text, options);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// 避免使用者輸入 =、+、-、@ 開頭被 Sheet 當成公式執行
function safeCell_(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function escapeHtml_(value) {
  return value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// 部署前在編輯器手動執行一次：授權寄信 / Drive / Sheet 權限，並寄一封測試信給自己
function testSend() {
  getSheet_();
  sendDeck_(PropertiesService.getScriptProperties(), 'テスト', Session.getActiveUser().getEmail());
}
