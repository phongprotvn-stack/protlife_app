/**
 * DATA HUB — Connector registry
 *
 * Add a new connector = new import/export source.
 * Frontend and database never change.
 */
const connectors = new Map();

export function registerConnector(name, connector) {
  connectors.set(name, connector);
}

export function getConnector(name) {
  return connectors.get(name);
}

export function listConnectors() {
  return Array.from(connectors.keys());
}

export async function runImport(connectorName, source, userId, db) {
  const connector = connectors.get(connectorName);
  if (!connector) throw new Error(`Unknown connector: ${connectorName}`);
  const raw = await connector.fetch(source);
  const transformed = connector.transform(raw);
  const result = { created: 0, updated: 0, failed: 0, errors: [] };

  const batch = db.batch();
  const peopleRef = db.collection('users').doc(userId).collection('people');

  for (const item of transformed) {
    try {
      if (item.id) {
        batch.set(peopleRef.doc(item.id), { ...item, updatedAt: new Date().toISOString() }, { merge: true });
        result.updated++;
      } else {
        const ref = peopleRef.doc();
        batch.set(ref, { ...item, id: ref.id, createdAt: new Date().toISOString() });
        result.created++;
      }
    } catch (e) {
      result.failed++;
      result.errors.push(e.message);
    }
  }
  await batch.commit();
  return result;
}

export async function runExport(connectorName, data, target) {
  const connector = connectors.get(connectorName);
  if (!connector) throw new Error(`Unknown connector: ${connectorName}`);
  return connector.export(data, target);
}

export default { registerConnector, getConnector, listConnectors, runImport, runExport };
