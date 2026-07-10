/**
 * PROT SPHERE — Apps Script: Google Sheet → Firestore sync
 *
 * Cách dùng:
 * 1. Mở Sheet "Mối quan hệ" → Extensions → Apps Script
 * 2. Paste code này
 * 3. Sửa 2 constants: FIREBASE_API_KEY và FIREBASE_PROJECT_ID
 * 4. Deploy → New deployment → Web app → Anyone
 * 5. Copy URL deploy (dạng .../exec)
 *
 * Tính năng:
 * - onEdit: khi sửa 1 dòng → tự động PATCH document đó lên Firestore
 * - onOpen + menu: "Đồng bộ tất cả lên Firestore"
 * - GET: trả về JSON danh sách (để debug)
 * - POST: nhận JSON object → ghi vào Firestore
 * - fullSync(): đồng bộ toàn bộ Sheet → Firestore
 */

// ─── CONFIG ───
// Lấy từ firebase.js — thay API key thật vào dòng dưới. Giữ nguyên projectId.
const FIREBASE_API_KEY = "AIzaSyAOHECF4A8UIgS8M4GFy_Bnt2sk1xFhKpo";
const FIREBASE_PROJECT_ID = "protlife-3dd56";
const SHEET_NAME = "Mối quan hệ";
const FIRESTORE_COLLECTION = "people";  // collection nào trong Firestore
const FIRESTORE_USER_ID = "guest";       // guest = user không cần login

// ─── Sheet helpers ───

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.getActiveSheet();
  return sheet;
}

function getSheetData() {
  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows[0];
  const data = [];
  for (let r = 1; r < rows.length; r++) {
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const val = rows[r][c];
      if (val !== '' && val !== undefined) {
        obj[headers[c]] = typeof val === 'string' ? val.trim() : val;
      }
    }
    if (obj['ID'] || obj['Name'] || obj['Tên']) {
      if (!obj['id']) obj['id'] = (obj['ID'] || obj['id'] || Utilities.getUuid()).toString();
      obj['id'] = (obj['ID'] || obj['id']).toString();
      delete obj['ID'];
      data.push(obj);
    }
  }
  return data;
}

// ─── Firestore REST API ───

function firestoreBaseUrl() {
  return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${FIRESTORE_COLLECTION}`;
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreFields(fields) {
  const obj = {};
  for (const [key, val] of Object.entries(fields)) {
    if (val.stringValue !== undefined) obj[key] = val.stringValue;
    else if (val.integerValue !== undefined) obj[key] = parseInt(val.integerValue, 10);
    else if (val.doubleValue !== undefined) obj[key] = val.doubleValue;
    else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
    else if (val.arrayValue !== undefined) {
      obj[key] = (val.arrayValue.values || []).map(v => {
        if (v.stringValue !== undefined) return v.stringValue;
        if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
        return v;
      });
    }
    else if (val.mapValue !== undefined) obj[key] = fromFirestoreFields(val.mapValue.fields || {});
  }
  return obj;
}

function rowToFirestoreDocument(row) {
  const fields = {};
  for (const [key, val] of Object.entries(row)) {
    fields[key] = toFirestoreValue(val);
  }
  return { fields };
}

function firestoreDocumentToRow(doc) {
  return fromFirestoreFields(doc.fields || {});
}

function firestoreFetch(path, options = {}) {
  const url = `${firestoreBaseUrl()}${path}&key=${FIREBASE_API_KEY}`;
  const params = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    muteHttpExceptions: true,
  };
  if (options.body) params.payload = JSON.stringify(options.body);
  const response = UrlFetchApp.fetch(url, params);
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code >= 200 && code < 300) {
    return text ? JSON.parse(text) : null;
  }
  throw new Error(`Firestore API error ${code}: ${text}`);
}

// ─── Sync: Sheet → Firestore ───

function fullSync() {
  const data = getSheetData();
  if (data.length === 0) {
    return { status: 'ok', message: 'Sheet trống, không có gì để đồng bộ', count: 0 };
  }
  let updated = 0, created = 0, failed = 0;

  for (const row of data) {
    try {
      const docId = encodeURIComponent(row.id);
      const docBody = rowToFirestoreDocument(row);

      // Try GET first to check if exists
      let exists = false;
      try {
        const existing = firestoreFetch(`/${docId}?`, { method: 'GET' });
        exists = !!existing;
      } catch (e) { exists = false; }

      if (exists) {
        // PATCH = update
        firestoreFetch(`/${docId}?updateMask.fieldPaths=`, {
          method: 'PATCH',
          body: docBody,
        });
        updated++;
      } else {
        // POST = create
        firestoreFetch(`?documentId=${docId}`, {
          method: 'POST',
          body: docBody,
        });
        created++;
      }
    } catch (e) {
      failed++;
      console.error(`Failed to sync row ${row.id}: ${e.message}`);
    }
  }

  // ─── Xoá documents cũ không còn trong Sheet ───
  let deleted = 0;
  try {
    // Get all existing Firestore docs for this user path
    const allDocs = firestoreFetch(`?`);
    const existingDocs = allDocs.documents || [];
    const sheetIds = new Set(data.map(r => r.id));
    for (const doc of existingDocs) {
      const docId = doc.name.split('/').pop();
      const decodedId = decodeURIComponent(docId);
      if (!sheetIds.has(decodedId)) {
        try {
          firestoreFetch(`/${docId}?`, { method: 'DELETE' });
          deleted++;
        } catch (e) {
          console.warn(`Failed to delete ${decodedId}: ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.warn(`Failed to clean up stale docs: ${e.message}`);
  }

  return {
    status: 'ok',
    message: `Đã đồng bộ: ${created} tạo mới, ${updated} cập nhật, ${deleted} xoá`,
    created, updated, deleted, failed, total: data.length,
  };
}

function syncSingleRow(row) {
  const docId = encodeURIComponent(row.id);
  const docBody = rowToFirestoreDocument(row);

  let exists = false;
  try {
    const existing = firestoreFetch(`/${docId}?`, { method: 'GET' });
    exists = !!existing;
  } catch (e) { exists = false; }

  if (exists) {
    firestoreFetch(`/${docId}?updateMask.fieldPaths=`, {
      method: 'PATCH',
      body: docBody,
    });
    return 'updated';
  } else {
    firestoreFetch(`?documentId=${docId}`, {
      method: 'POST',
      body: docBody,
    });
    return 'created';
  }
}

// ─── Triggers ───

function onEdit(e) {
  const range = e ? e.range : null;
  if (!range) return;

  const sheet = range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;
  if (range.getRow() < 2) return; // skip header

  const rowIndex = range.getRow();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];

  const obj = {};
  for (let c = 0; c < headers.length; c++) {
    const val = rowData[c];
    if (val !== '' && val !== undefined) {
      obj[headers[c]] = typeof val === 'string' ? val.trim() : val;
    }
  }

  let id = obj['ID'] || obj['id'];
  if (!id) {
    // New row without ID — assign one
    id = Utilities.getUuid();
    // Write ID back to sheet
    const idCol = headers.indexOf('ID');
    if (idCol >= 0) sheet.getRange(rowIndex, idCol + 1).setValue(id);
  }

  obj['id'] = id.toString();
  delete obj['ID'];

  try {
    const result = syncSingleRow(obj);
    console.log(`Row ${rowIndex} → Firestore: ${result} (id: ${id})`);
  } catch (e) {
    console.error(`Row ${rowIndex} sync failed: ${e.message}`);
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('PROT SPHERE')
    .addItem('🔥 Đồng bộ tất cả lên Firestore', 'fullSyncUi')
    .addToUi();
}

function fullSyncUi() {
  const result = fullSync();
  SpreadsheetApp.getUi().alert(
    `✅ ${result.message}\n` +
    `Tạo mới: ${result.created} | Cập nhật: ${result.updated} | Xoá: ${result.deleted}` +
    (result.failed > 0 ? ` | Lỗi: ${result.failed}` : '')
  );
}

// ─── Web App endpoints ───

function doGet() {
  try {
    const data = getSheetData();
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', count: data.length, data, sheet: SHEET_NAME }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: e.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.action === 'fullSync') {
      const result = fullSync();
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (body.action === 'syncRow' && body.row) {
      syncSingleRow(body.row);
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', action: 'syncRow', id: body.row.id }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (body.action === 'getData') {
      const data = getSheetData();
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', count: data.length, data }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: e.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
