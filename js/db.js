import { showToast } from './utils.js';

const DB_NAME = 'EduDataDB';
const DB_VERSION = 1;
const STORE_NAME = 'students';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('CLASS', 'CLASS', { unique: false });
                store.createIndex('ACADEMIC_YEAR', 'ACADEMIC_YEAR', { unique: false });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

let dbPromise = null;

function getDB() {
    if (!dbPromise) dbPromise = openDB();
    return dbPromise;
}

// ── File System Backup ──
const META_DB = 'EduDataMeta';
const META_VER = 1;
let metaDbPromise = null;

function openMetaDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(META_DB, META_VER);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('kv')) {
                db.createObjectStore('kv');
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

function getMetaDB() {
    if (!metaDbPromise) metaDbPromise = openMetaDB();
    return metaDbPromise;
}

async function metaGet(key) {
    const db = await getMetaDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readonly');
        const req = tx.objectStore('kv').get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function metaPut(key, val) {
    const db = await getMetaDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite');
        const req = tx.objectStore('kv').put(val, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function setupBackup() {
    if (typeof showDirectoryPicker !== 'function') {
        showToast('File System API not supported in this browser.', '#EF4444');
        return false;
    }
    try {
        const handle = await showDirectoryPicker({ mode: 'readwrite', id: 'edu-backup' });
        await metaPut('backupDir', handle);
        showToast('✅ Backup folder set! Data will auto-save here.', '#065F46');
        return true;
    } catch (e) {
        if (e.name !== 'AbortError' && e.name !== 'SecurityError') {
            showToast('❌ Failed to set backup folder.', '#EF4444');
        }
        return false;
    }
}

export async function hasBackupHandle() {
    try {
        return !!(await metaGet('backupDir'));
    } catch { return false; }
}

export async function saveBackupToDisk(data) {
    try {
        let handle = await metaGet('backupDir');
        if (!handle) return false;
        const perm = await handle.requestPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
            handle = null; return false;
        }
        const fileHandle = await handle.getFileHandle('EduData_backup.json', { create: true });
        const writable = await fileHandle.createWritable({ keepExistingData: false });
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
        localStorage.setItem('lastBackupWrite', String(Date.now()));
        window.dispatchEvent(new CustomEvent('backup-written'));
        return true;
    } catch (e) {
        console.warn('Disk backup failed:', e);
        return false;
    }
}

export async function restoreFromDiskFile() {
    if (typeof showOpenFilePicker !== 'function') {
        showToast('File System API not supported.', '#EF4444');
        return null;
    }
    try {
        const [fileHandle] = await showOpenFilePicker({
            id: 'edu-restore',
            types: [{ description: 'EduData Backup', accept: { 'application/json': ['.json'] } }]
        });
        const file = await fileHandle.getFile();
        if (file.size > 50 * 1024 * 1024) { showToast('File too large (>50MB).', '#EF4444'); return null; }
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data)) { showToast('Invalid backup file.', '#EF4444'); return null; }
        return data;
    } catch (e) {
        if (e.name !== 'AbortError') showToast('❌ Restore cancelled or failed.', '#EF4444');
        return null;
    }
}

// ── Main DB operations ──

export async function loadAll() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function saveRecord(record) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function deleteRecord(id) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function deleteMany(ids) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        let completed = 0;
        ids.forEach(id => {
            const req = store.delete(id);
            req.onsuccess = () => { completed++; if (completed === ids.length) resolve(); };
            req.onerror = () => reject(req.error);
        });
        if (!ids.length) resolve();
    });
}

export async function upsertMany(records) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        let completed = 0;
        records.forEach(r => {
            const req = store.put(r);
            req.onsuccess = () => { completed++; if (completed === records.length) resolve(); };
            req.onerror = () => reject(req.error);
        });
        if (!records.length) resolve();
    });
}

export async function clearAll() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function syncToLocalStorage() {
    try {
        const data = await loadAll();
        localStorage.setItem('eduDB_v4_final', JSON.stringify(data));
    } catch (e) {
        console.warn('syncToLocalStorage failed:', e);
    }
}

export async function migrateFromLocalStorage() {
    const local = JSON.parse(localStorage.getItem('eduDB_v4_final')) || [];
    if (!local.length) return 0;
    const existing = await loadAll();
    const existingIds = new Set(existing.map(r => r.id));
    const newRecords = local.filter(r => !existingIds.has(r.id));
    if (newRecords.length) {
        await upsertMany(newRecords);
    }
    return newRecords.length;
}
