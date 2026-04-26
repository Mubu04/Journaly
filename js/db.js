'use strict';

const DB_NAME    = 'journaly-db';
const DB_VERSION = 1;
const STORE      = 'entries';

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('date',      'date',      { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

function tx(mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store       = transaction.objectStore(STORE);
    const req         = fn(store);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  }));
}

/* ── Public API ── */

function addEntry(entry) {
  return tx('readwrite', s => s.add(entry));
}

function getAllEntries() {
  return tx('readonly', s => s.getAll());
}

function deleteEntry(id) {
  return tx('readwrite', s => s.delete(id));
}

function updateEntry(entry) {
  return tx('readwrite', s => s.put(entry));
}

function clearAllEntries() {
  return tx('readwrite', s => s.clear());
}
