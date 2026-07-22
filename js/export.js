import { FIELDS, COLUMN_MAP, formatDate, esc, showToast, getFilteredRows, DATE_FIELDS, normaliseDropdownValue } from './utils.js';
import { getDb, setDb, getSelectedIds } from './form.js';


let selectedCols = new Set(COLUMN_MAP.map(c => c.field));

export function exportToExcel() {
    let db = getDb();
    if (!db.length) { showToast('No data to export!','#F59E0B'); return; }
    const exportData = db.map(s => {
        const row = {};
        COLUMN_MAP.forEach(c => row[c.label] = DATE_FIELDS.includes(c.field) ? formatDate(s[c.field]) : (s[c.field]||''));
        return row;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'Student_Database_v1.0.xlsx');
}

export function exportFilteredData() {
    let db = getDb();
    const rows = getFilteredRows(db);
    if (!rows.length) { showToast('No records match current filters!','#F59E0B'); return; }
    const exportData = rows.map(s => {
        const row = {};
        COLUMN_MAP.forEach(c => row[c.label] = DATE_FIELDS.includes(c.field) ? formatDate(s[c.field]) : (s[c.field]||''));
        return row;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    const yearVal = document.getElementById('tbl-year').value;
    const fileName = yearVal ? `Filtered_Students_${yearVal}.xlsx` : 'Filtered_Students_AllYears.xlsx';
    XLSX.writeFile(wb, fileName);
    showToast('✅ Filtered data exported!','#065F46');
}

export function exportToCSV() {
    let db = getDb();
    if (!db.length) { showToast('No data to export!','#F59E0B'); return; }
    const headers = COLUMN_MAP.map(c => c.label).join(',');
    const csvRows = db.map(s => {
        return COLUMN_MAP.map(c => {
            let val = DATE_FIELDS.includes(c.field) ? formatDate(s[c.field]) : (s[c.field]||'');
            val = String(val).replace(/"/g,'""').replace(/\r?\n|\r/g,' ');
            return `"${val}"`;
        }).join(',');
    }).join('\n');
    const csv = headers + '\n' + csvRows;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Student_Database.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    showToast('✅ CSV exported!','#065F46');
}

export function importExcel() {
    document.getElementById('importFileInput').click();
}

export async function handleImportFile(event) {
    let db = getDb();
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data     = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type:'array', cellDates:true });
            const sheet    = workbook.Sheets[workbook.SheetNames[0]];
            const rows     = XLSX.utils.sheet_to_json(sheet, { defval:'' });

            if (!rows.length) { showToast('No data rows found in file','#F59E0B'); return; }

            function norm(str) {
                return String(str).toUpperCase().replace(/[\s_.\-\(\)]/g,'');
            }
            const fieldMap = {};
            FIELDS.forEach(f => { fieldMap[norm(f)] = f; });
            const aliases = {
                'VOCSUBJECTCURRENT': 'VOC_NAME_CURRENT',
                'VOCCURRENTYEARSSUBJECT': 'VOC_NAME_CURRENT',
                'VOCSUBJECTCURRENTYEAR': 'VOC_NAME_CURRENT',
            };
            Object.assign(fieldMap, aliases);

            let imported = 0, skipped = 0;
            const pendingRecords = [];

            rows.forEach((row, i) => {
                const record = {
                    id   : Date.now() + i * 7 + Math.floor(Math.random()*999),
                    photo: ''
                };
                let hasData = false;

                Object.keys(row).forEach(col => {
                    const mapped = fieldMap[norm(col)];
                    if (!mapped) return;
                    let val = row[col];
                    if (val instanceof Date && !isNaN(val)) {
                        val = val.getFullYear() + '-' +
                              String(val.getMonth()+1).padStart(2,'0') + '-' +
                              String(val.getDate()).padStart(2,'0');
                    } else {
                        val = String(val).trim();
                    }
                    val = normaliseDropdownValue(mapped, val);
                    record[mapped] = val;
                    if (val) hasData = true;
                });

                FIELDS.forEach(f => { if (record[f] === undefined) record[f] = ''; });
                ['HOSTEL_STUDENT','ORPHAN','VOC_CURRENT_YR'].forEach(f => {
                    if (!record[f]) record[f] = 'No';
                });
                if (!record['APL_BPL']) record['APL_BPL'] = 'APL';
                if (record['VOC_NAME_CURRENT'] && record['VOC_CURRENT_YR'] === 'No') record['VOC_CURRENT_YR'] = 'Yes';

                if (hasData) { imported++; pendingRecords.push(record); }
                else { skipped++; }
            });

            if (imported === 0) { showToast('No valid records found!','#F59E0B'); return; }
            if (!confirm(`Import ${imported} record${imported>1?'s':''}?`)) { return; }

            const { upsertMany, syncToLocalStorage, saveBackupToDisk } = await import('./db.js');
            pendingRecords.forEach(r => db.push(r));
            try { await upsertMany(pendingRecords); await syncToLocalStorage(); saveBackupToDisk(db).catch(()=>{}); } catch(e) { showToast('Storage full!','#EF4444'); }
            window.updateDashboard();
            const msg = skipped ? `✅ Imported ${imported} records (${skipped} blank rows skipped)` : `✅ Imported ${imported} records successfully!`;
            showToast(msg,'#065F46');
        } catch(err) {
            console.error(err);
            showToast('❌ Import failed: ' + err.message,'#EF4444');
        }
    };
    reader.readAsArrayBuffer(file);
}

export function exportPhotos() {
    let db = getDb();
    const withPhotos = db.filter(s => s.photo);
    if (!withPhotos.length) { showToast('No photos to export!','#F59E0B'); return; }
    if (typeof JSZip === 'undefined') { showToast('JSZip library not loaded!','#EF4444'); return; }
    const zip = new JSZip();
    let count = 0;
    withPhotos.forEach(s => {
        const folder = `${s.CLASS||'Unknown'}-${s.ACADEMIC_YEAR||'Unknown'}`;
        const roll = s.ROLL_NO || '0';
        const firstName = (s.STUDENT_NAME||'Unknown').split(' ')[0];
        const ext = s.photo.includes('image/png') ? 'png' : 'jpg';
        const name = `${roll}-${firstName}.${ext}`;
        const base64 = s.photo.split(',')[1];
        if (base64) { zip.folder(folder).file(name, base64, {base64: true}); count++; }
    });
    if (!count) { showToast('No valid photos found!','#F59E0B'); return; }
    zip.generateAsync({type:'blob'}).then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Photos_${new Date().toISOString().slice(0,10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        showToast(`✅ Downloaded ${count} photos as ZIP`);
    });
}

export function openColumnSelector() {
    selectedCols = new Set(COLUMN_MAP.map(c => c.field));
    renderColumnGrid();
    document.getElementById('colModalSelectAll').checked = true;
    document.getElementById('columnModal').style.display = 'flex';
}

export function closeColumnSelector() {
    document.getElementById('columnModal').style.display = 'none';
}

export function closePreview() {
    document.getElementById('previewModal').style.display = 'none';
}

function renderColumnGrid() {
    const grid = document.getElementById('colCheckboxGrid');
    const checkSvg = `<svg viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 6 5 9 10 3"/></svg>`;
    grid.innerHTML = COLUMN_MAP.map((col) => {
        const isSelected = selectedCols.has(col.field);
        return `
            <div class="col-checkbox-item ${isSelected ? 'selected' : ''}" onclick="toggleCol('${col.field}')">
                <div class="check-box">${checkSvg}</div>
                <label>${col.label}</label>
            </div>`;
    }).join('');
}

window.toggleCol = function(field) {
    if (selectedCols.has(field)) selectedCols.delete(field);
    else selectedCols.add(field);
    renderColumnGrid();
    document.getElementById('colModalSelectAll').checked = selectedCols.size === COLUMN_MAP.length;
};

window.toggleSelectAllColumns = function() {
    const checked = document.getElementById('colModalSelectAll').checked;
    if (checked) selectedCols = new Set(COLUMN_MAP.map(c => c.field));
    else selectedCols.clear();
    renderColumnGrid();
};

function getExportRows() {
    let db = getDb();
    const rows = getFilteredRows(db);
    const cb = document.getElementById('exportSelectedOnly');
    if (!cb || !cb.checked) return rows;
    const ids = [...getSelectedIds()];
    return rows.filter(s => ids.includes(s.id));
}

export function previewSelectedColumns() {
    const cols = getSelectedColumns();
    if (!cols.length) { showToast('Select at least one column!','#F59E0B'); return; }
    const rows = getExportRows();
    if (!rows.length) { showToast('No data to preview!','#F59E0B'); return; }
    const yearVal = document.getElementById('tbl-year').value;
    const yearLabel = yearVal ? yearVal : 'All Years';
    const thead = '<tr>' + cols.map(c => `<th>${c.label}</th>`).join('') + '</tr>';
    const tbody = rows.map((r, i) => {
        return '<tr>' + cols.map(c => {
            const val = DATE_FIELDS.includes(c.field) ? formatDate(r[c.field]) : (r[c.field] || '-');
            return `<td>${esc(val)}</td>`;
        }).join('') + '</tr>';
    }).join('');
    document.getElementById('previewBody').innerHTML = `
        <p class="preview-count">Academic Year: ${yearLabel} | Showing ${rows.length} student${rows.length!==1?'s':''}</p>
        <div style="overflow-x:auto;"><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`;
    document.getElementById('previewModal').style.display = 'flex';
}

function getSelectedColumns() {
    return COLUMN_MAP.filter(c => selectedCols.has(c.field));
}

export function printSelectedColumns() {
    closePreview();
    const cols = getSelectedColumns();
    if (!cols.length) { showToast('Select at least one column!','#F59E0B'); return; }
    const rows = getExportRows();
    if (!rows.length) { showToast('No data to print!','#F59E0B'); return; }
    const yearVal = document.getElementById('tbl-year').value;
    const yearLabel = yearVal ? yearVal : 'All Years';
    const thead = '<tr>' + cols.map(c => `<th>${c.label}</th>`).join('') + '</tr>';
    const tbody = rows.map((r, i) => {
        return '<tr>' + cols.map(c => {
            const val = DATE_FIELDS.includes(c.field) ? formatDate(r[c.field]) : (r[c.field] || '-');
            return `<td>${esc(val)}</td>`;
        }).join('') + '</tr>';
    }).join('');
    const html = `
        <h2>EduData - Student Summary</h2>
        <p class="print-subtitle">Academic Year: ${esc(yearLabel)} | Total: ${rows.length} students | Printed: ${new Date().toLocaleDateString()}</p>
        <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
        <div class="print-footer">Generated by EduData v3.0</div>`;
    document.getElementById('printSummaryArea').innerHTML = html;
    closeColumnSelector();
    setTimeout(() => window.print(), 100);
}

export function exportSelectedColumns() {
    closePreview();
    const cols = getSelectedColumns();
    if (!cols.length) { showToast('Select at least one column!','#F59E0B'); return; }
    const rows = getExportRows();
    if (!rows.length) { showToast('No data to export!','#F59E0B'); return; }
    const exportData = rows.map(r => {
        const row = {};
        cols.forEach(c => row[c.label] = DATE_FIELDS.includes(c.field) ? formatDate(r[c.field]) : (r[c.field] || ''));
        return row;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    const yearVal = document.getElementById('tbl-year').value;
    const fileName = yearVal ? `Student_Summary_${yearVal}.xlsx` : 'Student_Summary_AllYears.xlsx';
    XLSX.writeFile(wb, fileName);
    closeColumnSelector();
    showToast('✅ Exported successfully!','#065F46');
}

export function downloadBackup() {
    let db = getDb();
    if (!db || !db.length) { showToast('No data to backup!','#F59E0B'); return; }
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `EduData_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    localStorage.setItem('lastBackupWrite', String(Date.now()));
    window.updateBackupStatus();
    showToast(`✅ Downloaded ${db.length} records as JSON`);
}

export function restoreBackup() {
    document.getElementById('restoreFileInput').click();
}

export async function handleRestoreFile(event) {
    let db = getDb();
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) { showToast('Invalid backup file: expected an array of records.', '#EF4444'); return; }
            if (!data.length) { showToast('Backup file is empty.', '#F59E0B'); return; }
            if (!confirm(`Restore ${data.length} records? This will REPLACE all current data (${db.length} records).`)) return;
            try {
                const { clearAll, upsertMany, syncToLocalStorage, saveBackupToDisk } = await import('./db.js');
                await clearAll();
                await upsertMany(data);
                await syncToLocalStorage();
                saveBackupToDisk(data).catch(()=>{});
            } catch(err) { showToast('Storage error!', '#EF4444'); return; }
            setDb(data);
            window.updateDashboard();
            showToast(`✅ Restored ${db.length} records from backup!`, '#065F46');
        } catch(err) {
            console.error(err);
            showToast('❌ Restore failed: Invalid JSON file.', '#EF4444');
        }
    };
    reader.readAsText(file);
}
