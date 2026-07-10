const url = 'https://script.google.com/macros/s/AKfycbyYk8FPm8-tgdCf7Sz4FN11dBBQiREiiPNkM4EGlfdNVNI0YAVxp-HnHesnUYMi2r12/exec';

async function main() {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'fullSync' }),
  });
  const text = await resp.text();
  console.log('Status:', resp.status);
  console.log('Body:', text.slice(0, 3000));
}

main().catch(e => console.error(e));
