import { FIELDS, getCurrentAcademicYear, normaliseDropdownValue, showToast, toggleSection, toggleVoc, NORM_FIELDS, YN_FIELDS, formatDate } from './utils.js';
import { loadAll, syncToLocalStorage, migrateFromLocalStorage, upsertMany, setupBackup, hasBackupHandle, restoreFromDiskFile, saveBackupToDisk } from './db.js';
import { setDb, getDb, resetApp, handleSave, handleUpdate, handleDelete, wipeDatabase, openSearch, closeSearch, performSearch, startEdit, printRecord, printAll, previewImage, startCamera, closeCamera, switchCamera, capturePhoto } from './form.js';
import { renderClassTable, changePage, onYearFilterChange, updateSummaryStats, clearTableFilters, toggleRowSelect, toggleSelectAll, selectAllFiltered, clearSelection, deleteSelected, openBulkEdit, applyBulkEdit, autoAllotRollNumbers } from './table.js';
import { renderDashboard } from './dashboard.js';
import { exportToExcel, exportFilteredData, exportToCSV, importExcel, handleImportFile, exportPhotos, openColumnSelector, closeColumnSelector, closePreview, previewSelectedColumns, printSelectedColumns, exportSelectedColumns, downloadBackup, restoreBackup, handleRestoreFile } from './export.js';

let formDirty = false;

export function updateDashboard() {
    document.getElementById('totalStudents').innerText = getDb().length;
    document.getElementById('boys').innerText  = getDb().filter(s => s.GENDER==='Male').length;
    document.getElementById('girls').innerText = getDb().filter(s => s.GENDER==='Female').length;
    updateSummaryStats(); renderClassTable();
    renderDashboard();
}
window.updateDashboard = updateDashboard;

function fixExistingData() {
    let db = getDb();
    let changed = 0;
    db.forEach(s => {
        FIELDS.forEach(f => { if (s[f] === undefined) { s[f] = ''; changed++; } });
        NORM_FIELDS.forEach(f => {
            const orig = s[f];
            s[f] = normaliseDropdownValue(f, s[f]);
            if (s[f] !== orig) changed++;
        });
        YN_FIELDS.forEach(f => { if (s[f] === '') { s[f] = 'No'; changed++; } });
        if (!s['APL_BPL']) { s['APL_BPL'] = 'APL'; changed++; }
        if (s['VOC_NAME_CURRENT'] && s['VOC_CURRENT_YR'] === 'No') { s['VOC_CURRENT_YR'] = 'Yes'; changed++; }
    });
    if (changed > 0) {
        try { localStorage.setItem('eduDB_v4_final', JSON.stringify(db)); upsertMany(db).catch(() => {}); } catch(e) { showToast('Storage full!','#EF4444'); }
        console.log(`Fixed ${changed} fields.`);
    }
}

export async function initApp() {
    localStorage.removeItem('eduCurrentUser');
    localStorage.removeItem('eduUsers');
    let db = await loadAll();
    let restored = false;
    if (!db.length) {
        const migrated = await migrateFromLocalStorage();
        if (migrated) db = await loadAll();
    }
    if (!db.length) {
        const wantsRestore = confirm('No local data found. Would you like to restore from a backup file?');
        if (wantsRestore) {
            const data = await restoreFromDiskFile();
            if (data && data.length) {
                db = data;
                await upsertMany(db);
                await syncToLocalStorage();
                restored = true;
                showToast(`✅ Restored ${db.length} records from backup!`, '#065F46');
            }
        }
    }
    setDb(db);
    fixExistingData();
    document.getElementById('appContainer').style.display = 'block';
    updateBackupStatus();
    document.getElementById('ACADEMIC_YEAR').value = getCurrentAcademicYear();
    updateDashboard();
    updateBackupStatus();
}

export async function updateBackupStatus() {
    const el = document.getElementById('backupStatus');
    if (!el) { showBackupBanner(); return; }
    const has = await hasBackupHandle();
    if (!has) {
        el.innerHTML = '<i class="fa-regular fa-circle" style="color:#94A3B8;"></i>';
        el.title = 'No backup folder set';
    } else {
        const lastWrite = parseInt(localStorage.getItem('lastBackupWrite') || '0');
        const age = Date.now() - lastWrite;
        if (!lastWrite || age > 86400000) {
            el.innerHTML = '<i class="fa-solid fa-circle" style="color:#F59E0B;"></i>';
            el.title = lastWrite ? 'Backup folder set — no recent backup (>24h)' : 'Backup folder set — never written yet';
        } else {
            el.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#34D399;"></i>';
            el.title = 'Auto backup active and up to date';
        }
    }
    showBackupBanner();
}

async function showBackupBanner() {
    const banner = document.getElementById('backupBanner');
    if (!banner) return;
    if (localStorage.getItem('backupBannerDismissed') === '1') {
        banner.style.display = 'none';
        return;
    }
    const has = await hasBackupHandle();
    banner.style.display = has ? 'none' : 'flex';
}

window.dismissBackupBanner = function() {
    localStorage.setItem('backupBannerDismissed', '1');
    document.getElementById('backupBanner').style.display = 'none';
};

window.exportBackup = function() {
    downloadBackup();
    localStorage.setItem('backupBannerDismissed', '1');
    document.getElementById('backupBanner').style.display = 'none';
};

window.toggleGettingStarted = function() {
    const el = document.getElementById('gettingStarted');
    const icon = el.querySelector('.gs-toggle i');
    el.classList.toggle('collapsed');
    icon.className = el.classList.contains('collapsed') ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
};

window.dismissWelcome = function() {
    localStorage.setItem('welcomeSeen', '1');
    document.getElementById('welcomeModal').style.display = 'none';
};

function showWelcomeIfNeeded() {
    if (localStorage.getItem('welcomeSeen') !== '1') {
        document.getElementById('welcomeModal').style.display = 'flex';
    }
}

window.setupBackupHandler = async function() {
    const ok = await setupBackup();
    if (ok) {
        saveBackupToDisk(getDb()).catch(() => {});
        updateBackupStatus();
    }
};

window.addEventListener('load', async () => {
    document.querySelectorAll('.up').forEach(el =>
        el.addEventListener('input', () => el.value = el.value.toUpperCase())
    );
    document.querySelectorAll('#studentForm input, #studentForm select, #studentForm textarea').forEach(el =>
        el.addEventListener('input', () => { formDirty = true; })
    );
    if (localStorage.getItem('eduDarkMode') === '1') {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeToggle').innerHTML = '<i class="fa-solid fa-sun"></i>';
        document.querySelector('meta[name="theme-color"]').content = '#0F172A';
    }
    await initApp();
    window.addEventListener('backup-written', updateBackupStatus);
    showWelcomeIfNeeded();
});

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('installBtn');
    if (btn) btn.style.display = '';
});
window.addEventListener('appinstalled', () => {
    const btn = document.getElementById('installBtn');
    if (btn) btn.style.display = 'none';
    deferredPrompt = null;
});
window.installApp = async function() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
        const btn = document.getElementById('installBtn');
        if (btn) btn.style.display = 'none';
    }
    deferredPrompt = null;
};

export function setFormDirty(v) { formDirty = v; }
window.setFormDirty = setFormDirty;

export function switchTab(n) {
    if (formDirty && !confirm('You have unsaved changes. Discard?')) return;
    if (navigator.vibrate) navigator.vibrate(15);
    [1,2,3,4].forEach(i => {
        const ids = {1:'tab-home',2:'tab-dashboard',3:'tab-form',4:'tab-summary'};
        document.getElementById(ids[i]).classList.toggle('active', i===n);
        document.getElementById('tabBtn'+i).classList.toggle('active', i===n);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (n === 2) { renderDashboard(); }
    if (n === 4) { updateSummaryStats(); renderClassTable(); }
}

document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 's') { e.preventDefault();
        if (document.getElementById('updateBtn').style.display !== 'none') handleUpdate();
        else handleSave();
    }
    if (e.key === 'Escape') { closeSearch(); closeColumnSelector(); closePreview(); closeCamera(); }
    if (e.ctrlKey && e.key === 'f') { e.preventDefault(); openSearch(); }
});

window.toggleDarkMode = function() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('eduDarkMode', isDark ? '1' : '0');
    document.getElementById('darkModeToggle').innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    document.querySelector('meta[name="theme-color"]').content = isDark ? '#0F172A' : '#1E3A8A';
};

window.handleSave = handleSave;
window.handleUpdate = handleUpdate;
window.handleDelete = handleDelete;
window.wipeDatabase = wipeDatabase;
window.openSearch = openSearch;
window.closeSearch = closeSearch;
window.performSearch = performSearch;
window.startEdit = startEdit;
window.printRecord = printRecord;
window.printAll = printAll;
window.previewImage = previewImage;
window.startCamera = startCamera;
window.closeCamera = closeCamera;
window.switchCamera = switchCamera;
window.capturePhoto = capturePhoto;
window.resetApp = resetApp;
window.renderClassTable = renderClassTable;
window.renderDashboard = renderDashboard;
window.changePage = changePage;
window.onYearFilterChange = onYearFilterChange;
window.clearTableFilters = clearTableFilters;
window.toggleRowSelect = toggleRowSelect;
window.toggleSelectAll = toggleSelectAll;
window.selectAllFiltered = selectAllFiltered;
window.clearSelection = clearSelection;
window.deleteSelected = deleteSelected;
window.openBulkEdit = openBulkEdit;
window.applyBulkEdit = applyBulkEdit;
window.autoAllotRollNumbers = autoAllotRollNumbers;
window.exportToExcel = exportToExcel;
window.exportFilteredData = exportFilteredData;
window.exportToCSV = exportToCSV;
window.importExcel = importExcel;
window.handleImportFile = handleImportFile;
window.exportPhotos = exportPhotos;
window.openColumnSelector = openColumnSelector;
window.closeColumnSelector = closeColumnSelector;
window.closePreview = closePreview;
window.previewSelectedColumns = previewSelectedColumns;
window.printSelectedColumns = printSelectedColumns;
window.exportSelectedColumns = exportSelectedColumns;
window.downloadBackup = downloadBackup;
window.restoreBackup = restoreBackup;
window.handleRestoreFile = handleRestoreFile;
window.switchTab = switchTab;
window.updateBackupStatus = updateBackupStatus;
window.toggleSection = toggleSection;
window.toggleVoc = toggleVoc;
