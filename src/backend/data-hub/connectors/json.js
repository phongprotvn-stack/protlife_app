import { registerConnector } from '../index.js';

/**
 * JSON Connector — import/export ProtSphere data as JSON
 */
registerConnector('json', {
  name: 'JSON File',
  description: 'Import/Export dữ liệu dạng JSON',
  formats: ['json'],

  async fetch(source) {
    if (typeof source === 'object' && source.data) return source.data;
    if (typeof source === 'string') {
      const resp = await fetch(source);
      return resp.json();
    }
    return source;
  },

  transform(data) {
    // If data has .people, extract it
    if (data.people) return data.people;
    if (Array.isArray(data)) return data;
    return [data];
  },

  async export(data) {
    return JSON.stringify(data, null, 2);
  },
});
