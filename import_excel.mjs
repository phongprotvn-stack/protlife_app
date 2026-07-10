import XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

const filePath = 'C:/Users/phong/.hermes/desktop-attachments/Prot Contact.xlsx';
const buffer = readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer' });
const ws = wb.Sheets['Sheet1'];
const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

function excelSerialToDate(serial) {
  if (typeof serial !== 'number') return '';
  const d = new Date(Date.UTC(1899, 11, 30 + serial));
  return d.toISOString().split('T')[0];
}

const people = [];
const seenEmails = new Set();
const seenPhones = new Set();

for (const row of rows) {
  const name = (row.Name || '').trim();
  if (!name) continue;

  const phone = (row.Phones || '').trim();
  const email = (row.Emails || '').trim().toLowerCase();
  const birthday = excelSerialToDate(row.Birthday);
  const relationship = (row.Relationship || '').trim();
  const org = (row.Organization || '').trim();
  const facebook = (row.Facebook || '').trim();
  const tiktok = (row.Tiktok || '').trim();
  const address = (row.Address || '').trim();
  const score = typeof row['Relationship Score'] === 'number' ? row['Relationship Score'] : 50;

  // Dedup
  if (email && seenEmails.has(email)) continue;
  if (phone && seenPhones.has(phone)) continue;
  if (email) seenEmails.add(email);
  if (phone) seenPhones.add(phone);

  const id = 'imp_' + createHash('md5').update(name + birthday + phone).digest('hex').slice(0, 12);
  const notes = [relationship, org].filter(Boolean).join(' | ');

  people.push({
    id,
    name,
    nickname: '',
    phone,
    email,
    dob: birthday,
    gender: 'male',
    facebook,
    tiktok,
    address,
    firstMetDate: '',
    notes,
    tags: [],
    relationshipScore: score,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: 'excel-import',
  });
}

// WRAP in { people: [...] } for the frontend JSON import format
const output = { people };

const outPath = 'C:/Users/phong/.hermes/desktop-attachments/prot_contact_import.json';
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`✅ Written ${people.length} people to ${outPath}`);
console.log(`   Format: { "people": [...] } — ready for Data Hub → Import → JSON File`);
