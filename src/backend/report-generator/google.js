/**
 * GOOGLE SHEETS / DOCS EXPORT
 *
 * Exports data to Google Sheets or Google Docs via the Firebase
 * service account's Google Drive API.
 *
 * Uses googleapis library (if installed) or falls back to JSON.
 * For now, returns JSON that the frontend can import into Google.
 */

const CREDENTIALS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file',
];

/**
 * Export to Google Sheets
 * Creates a new spreadsheet with People/Events/Memories/Places tabs
 */
export async function generateGoogleSheets(data, options = {}) {
  const { title = 'ProtSphere Report' } = options;

  try {
    // Try using the Google APIs via service account
    const sheets = await getSheetsService();
    if (sheets) {
      return await createGoogleSheet(sheets, data, title);
    }
  } catch (e) {
    console.warn('Google Sheets API failed, returning JSON fallback:', e.message);
  }

  // Fallback: return structured JSON for manual import
  return {
    buffer: Buffer.from(JSON.stringify(buildGoogleSheetData(data), null, 2)),
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="google_sheets_import.json"',
    },
    filename: 'google_sheets_import.json',
  };
}

/**
 * Export to Google Docs
 * Creates a new document with a formatted report
 */
export async function generateGoogleDocs(data, options = {}) {
  const { title = 'ProtSphere Report' } = options;

  try {
    const docs = await getDocsService();
    if (docs) {
      return await createGoogleDoc(docs, data, title);
    }
  } catch (e) {
    console.warn('Google Docs API failed, returning JSON fallback:', e.message);
  }

  // Fallback: return markdown text that can be pasted into Google Docs
  const md = buildMarkdownReport(data, title);
  return {
    buffer: Buffer.from(md, 'utf-8'),
    headers: {
      'Content-Type': 'text/markdown',
      'Content-Disposition': 'attachment; filename="google_docs_import.md"',
    },
    filename: 'google_docs_import.md',
  };
}

// ─── Helpers ───

function buildGoogleSheetData(data) {
  return {
    people: data.people?.map(p => ({
      Name: p.name, Relationship: p.relationship, Phone: p.phones,
      Email: p.emails, Birthday: p.dob, Score: p.relationshipScore,
      Tags: p.tags, Note: p.note,
    })) || [],
    events: data.events?.map(e => ({
      Title: e.title, Date: e.date, Location: e.location,
      Description: e.description, Type: e.type,
    })) || [],
  };
}

function buildMarkdownReport(data, title) {
  let md = `# ${title}\n\n`;
  md += `*Generated: ${new Date().toISOString()}*\n\n`;

  md += `## Statistics\n\n`;
  md += `- People: ${data.people?.length || 0}\n`;
  md += `- Events: ${data.events?.length || 0}\n`;
  md += `- Memories: ${data.memories?.length || 0}\n`;
  md += `- Places: ${data.places?.length || 0}\n\n`;

  if (data.people?.length) {
    md += `## People\n\n`;
    md += `| Name | Relationship | Phone | Score |\n`;
    md += `|------|--------------|-------|-------|\n`;
    for (const p of data.people.slice(0, 100)) {
      md += `| ${p.name || ''} | ${p.relationship || ''} | ${Array.isArray(p.phones) ? p.phones.join(', ') : p.phones || ''} | ${p.relationshipScore ?? ''} |\n`;
    }
    md += '\n';
  }

  if (data.events?.length) {
    md += `## Events\n\n`;
    md += `| Title | Date | Location |\n`;
    md += `|-------|------|----------|\n`;
    for (const e of data.events.slice(0, 100)) {
      md += `| ${e.title || ''} | ${e.date || ''} | ${e.location || ''} |\n`;
    }
    md += '\n';
  }

  return md;
}

// ─── Google API Integration ───

async function getAuthClient() {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) return null;

  try {
    const { GoogleAuth, JWT } = await import('google-auth-library');
    const creds = JSON.parse(serviceAccount);
    const client = new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: CREDENTIALS_SCOPES,
    });
    await client.authorize();
    return client;
  } catch {
    return null;
  }
}

async function getSheetsService() {
  const auth = await getAuthClient();
  if (!auth) return null;
  const { google } = await import('googleapis');
  return google.sheets({ version: 'v4', auth });
}

async function getDocsService() {
  const auth = await getAuthClient();
  if (!auth) return null;
  const { google } = await import('googleapis');
  return google.docs({ version: 'v1', auth });
}

async function createGoogleSheet(sheets, data, title) {
  // Create spreadsheet
  const createResp = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        { properties: { title: 'Summary' } },
        { properties: { title: 'People' } },
        { properties: { title: 'Events' } },
        { properties: { title: 'Memories' } },
        { properties: { title: 'Places' } },
      ],
    },
  });

  const spreadsheetId = createResp.data.spreadsheetId;
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  // Write Summary
  if (data.people?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'People!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          ['Name', 'Relationship', 'Phone', 'Email', 'Score', 'Tags', 'Note'],
          ...data.people.map(p => [
            p.name || '', p.relationship || '',
            Array.isArray(p.phones) ? p.phones.join(', ') : '',
            Array.isArray(p.emails) ? p.emails.join(', ') : '',
            p.relationshipScore ?? '',
            Array.isArray(p.tags) ? p.tags.map(t => t.name || t).join(', ') : '',
            p.note || '',
          ]),
        ],
      },
    });
  }

  return {
    buffer: Buffer.from(JSON.stringify({ url: sheetUrl, spreadsheetId })),
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="google_sheet_link.json"',
    },
    filename: 'google_sheet_link.json',
    url: sheetUrl,
  };
}

async function createGoogleDoc(docs, data, title) {
  // Create document
  const createResp = await docs.documents.create({
    requestBody: { title },
  });

  const documentId = createResp.data.documentId;
  const docUrl = `https://docs.google.com/document/d/${documentId}`;

  // Build content with batchUpdate
  const requests = [
    { insertText: { location: { index: 1 }, text: `${title}\n\n` } },
    { insertText: { location: { index: 1 }, text: `Generated: ${new Date().toISOString()}\n\n` } },
    { insertText: { location: { index: 1 }, text: `People: ${data.people?.length || 0} | Events: ${data.events?.length || 0} | Memories: ${data.memories?.length || 0} | Places: ${data.places?.length || 0}\n\n` } },
  ];

  try {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
  } catch (e) {
    console.warn('Google Docs write failed:', e.message);
  }

  return {
    buffer: Buffer.from(JSON.stringify({ url: docUrl, documentId })),
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="google_doc_link.json"',
    },
    filename: 'google_doc_link.json',
    url: docUrl,
  };
}

export default { generateGoogleSheets, generateGoogleDocs };
