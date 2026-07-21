import { FIELDS, COLUMN_MAP, formatDate, esc, showToast, getFilteredRows, NORM_FIELDS, YN_FIELDS, DATE_FIELDS } from './utils.js';
import { upsertMany, deleteMany, syncToLocalStorage, saveBackupToDisk } from './db.js';
import { getDb, getSelectedIds, setSelectedIds } from './form.js';
import { updateDashboard } from './app.js';

let currentPage = 1;
const PAGE_SIZE = 50;
let lastFilterKey = '';

function getFilterKey() {
    return ['tbl-class','tbl-div','tbl-year','tbl-gender','tbl-voc-current','tbl-orphan','tbl-hostel','tbl-aplbpl']
        .map(id => document.getElementById(id).value).join('|');
}

export function renderClassTable() {
    let db = getDb();
    if (typeof db === 'undefined') return;
    const newKey = getFilterKey();
    if (newKey !== lastFilterKey) { setSelectedIds(new Set()); lastFilterKey = newKey; }
    const selectedIds = getSelectedIds();
    const fCls    = document.getElementById('tbl-class').value;
    const fDiv    = document.getElementById('tbl-div').value;
    const fYear   = document.getElementById('tbl-year').value;
    const fGender = document.getElementById('tbl-gender').value;
    const fVocCur = document.getElementById('tbl-voc-current').value;
    const fOrphan = document.getElementById('tbl-orphan').value;
    const fHostel = document.getElementById('tbl-hostel').value;
    const fApl    = document.getElementById('tbl-aplbpl').value;

    let rows = db.filter(s => {
        if (fCls    && s.CLASS         !== fCls)    return false;
        if (fDiv    && s.DIVISION       !== fDiv)    return false;
        if (fYear   && s.ACADEMIC_YEAR !== fYear)   return false;
        if (fGender && s.GENDER        !== fGender) return false;
        if (fVocCur && s.VOC_CURRENT_YR !== fVocCur) return false;
        if (fOrphan && s.ORPHAN        !== fOrphan) return false;
        if (fHostel && (fHostel==='Yes') !== (s.HOSTEL_STUDENT==='Yes')) return false;
        if (fApl    && s.APL_BPL       !== fApl)    return false;
        return true;
    });

    const classOrder = { 'XII': 0, 'XI': 1, 'X': 2, 'IX': 3 };
    rows.sort((a, b) => {
        const ca = classOrder[a.CLASS] ?? 99;
        const cb = classOrder[b.CLASS] ?? 99;
        if (ca !== cb) return ca - cb;
        const da = a.DIVISION || '';
        const dd = b.DIVISION || '';
        if (da !== dd) return da.localeCompare(dd);
        const ra = parseInt(a.ROLL_NO) || 0;
        const rb = parseInt(b.ROLL_NO) || 0;
        return ra - rb;
    });

    const totalPages = Math.ceil(rows.length / PAGE_SIZE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const pageRows = rows.slice((currentPage-1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const td = (val, center) => `<td class="tbl-cell ${center?'tbl-center':''}">${esc(val)||'-'}</td>`;
    const tdL = (val) => `<td class="tbl-cell tbl-cell-long">${esc(val)||'-'}</td>`;
    const badge = (val, cls) => {
        const v = val||'No';
        return `<span class="badge badge-${cls}-${v==='Yes'?'yes':'no'}">${esc(v)}</span>`;
    };

    document.getElementById('classTableBody').innerHTML = rows.length
        ? pageRows.map((r,i) => `
            <tr class="${(i+(currentPage-1)*PAGE_SIZE)%2===0?'row-even':'row-odd'}${selectedIds.has(r.id)?' row-selected':''}" style="cursor:pointer;" onclick="import('./form.js').then(m => m.startEdit(${r.id}))">
                <td class="tbl-cell tbl-center"><input type="checkbox" class="row-select" value="${r.id}" ${selectedIds.has(r.id)?'checked':''} onclick="event.stopPropagation();toggleRowSelect(this,${r.id})"></td>
                ${td((currentPage-1)*PAGE_SIZE+i+1,true)}
                ${td(r.CLASS,true)} ${td(r.DIVISION,true)} ${td(r.ROLL_NO,true)} ${td(r.GR_NO,true)}
                <td class="tbl-cell tbl-name">${esc(r.STUDENT_NAME||'-')}</td>
                ${td(formatDate(r.DOA),true)} ${td(r.PREV_SCHOOL)} ${td(r.GENDER,true)}
                ${td(formatDate(r.DOB_LC),true)} ${td(r.POB,true)} ${td(r.CASTE,true)}
                ${td(r.AADHAR_NO,true)} ${td(r.NAME_AADHAR)} ${td(formatDate(r.DOB_AADHAR),true)}
                ${td(r.FATHER_NAME)} ${td(r.MOTHER_NAME)} ${td(r.MOBILE_1,true)} ${td(r.MOBILE_2,true)}
                ${td(r.EMAIL_ID)} ${tdL(r.ADDRESS)}
                ${td(r.BANK_ACC,true)} ${td(r.BANK_NAME)} ${td(r.IFSC,true)} ${td(r.PEN,true)} ${td(r.APAAR,true)}
                ${td(r.BLOOD_GROUP,true)} ${td(r.HEIGHT,true)} ${td(r.WEIGHT,true)}
                ${td(r.PERCENTAGE,true)} ${td(r.DISTANCE,true)}
                <td class="tbl-cell tbl-center">${badge(r.ORPHAN,'orphan')}</td>
                <td class="tbl-cell tbl-center">${badge(r.HOSTEL_STUDENT,'hostel')}</td>
                ${td(r.APL_BPL,true)} ${tdL(r.REMARK)}
                <td class="tbl-cell tbl-center">${badge(r.VOC_CURRENT_YR,'voc')}</td>
                ${td(r.VOC_NAME_CURRENT)} ${td(r.ACADEMIC_YEAR,true)}
            </tr>`).join('')
        : `<tr><td colspan="39" class="tbl-empty">No records match the selected filters.</td></tr>`;

    const startRow = rows.length ? (currentPage-1)*PAGE_SIZE+1 : 0;
    const endRow = Math.min(currentPage*PAGE_SIZE, rows.length);
    document.getElementById('tableCount').textContent =
        rows.length ? `Showing ${startRow}-${endRow} of ${rows.length} (filtered from ${db.length} total)` : `No records match the selected filters.`;
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages} (${rows.length} records)`;
    document.getElementById('paginationControls').style.display = rows.length > PAGE_SIZE ? 'flex' : 'none';
    const allFilteredIds = new Set(rows.map(r => r.id));
    document.getElementById('selectAll').checked = allFilteredIds.size > 0 && [...allFilteredIds].every(id => selectedIds.has(id));
    const sel = document.getElementById('selectedCount');
    sel.textContent = selectedIds.size ? `✓ ${selectedIds.size} record${selectedIds.size>1?'s':''} selected for bulk action` : '';
    updateSummaryStats();
}

export function changePage(delta) {
    const newPage = currentPage + delta;
    if (newPage < 1) return;
    const rows = getFilteredRows(getDb());
    const totalPages = Math.ceil(rows.length / PAGE_SIZE) || 1;
    if (newPage <= totalPages) { currentPage = newPage; renderClassTable(); }
}

export function onYearFilterChange() {
    const year = document.getElementById('summaryYearFilter').value;
    document.getElementById('tbl-year').value = year;
    updateSummaryStats();
    renderClassTable();
}

export function updateSummaryStats() {
    let db = getDb();
    const filtered = getFilteredRows(db);
    document.getElementById('s-total').textContent  = filtered.length;
    document.getElementById('s-boys').textContent   = filtered.filter(s => s.GENDER==='Male').length;
    document.getElementById('s-girls').textContent  = filtered.filter(s => s.GENDER==='Female').length;
    document.getElementById('s-ix').textContent     = filtered.filter(s => s.CLASS==='IX').length;
    document.getElementById('s-x').textContent      = filtered.filter(s => s.CLASS==='X').length;
    document.getElementById('s-xi').textContent     = filtered.filter(s => s.CLASS==='XI').length;
    document.getElementById('s-xii').textContent    = filtered.filter(s => s.CLASS==='XII').length;
    updateYearBadge();
}

function updateYearBadge() {
    const year = document.getElementById('tbl-year').value;
    const filtered = getFilteredRows(getDb());
    document.getElementById('yearCountBadge').textContent = year ? `${year} — ${filtered.length}` : `All — ${filtered.length}`;
    document.getElementById('summaryYearFilter').value = year;
}

export function clearTableFilters() {
    ['tbl-class','tbl-div','tbl-year','tbl-gender','tbl-voc-current','tbl-orphan','tbl-hostel','tbl-aplbpl']
        .forEach(id => document.getElementById(id).value = '');
    document.getElementById('summaryYearFilter').value = '';
    updateSummaryStats();
    renderClassTable();
}

export function toggleRowSelect(cb, id) {
    const selectedIds = getSelectedIds();
    if (cb.checked) selectedIds.add(id); else selectedIds.delete(id);
    cb.closest('tr').classList.toggle('row-selected', cb.checked);
}

export function toggleSelectAll(el) {
    let db = getDb();
    const selectedIds = getSelectedIds();
    const rows = getFilteredRows(db);
    if (el.checked) {
        rows.forEach(r => selectedIds.add(r.id));
    } else {
        selectedIds.clear();
    }
    renderClassTable();
}

export function selectAllFiltered() {
    let db = getDb();
    const selectedIds = getSelectedIds();
    const rows = getFilteredRows(db);
    if (!rows.length) { showToast('No records match current filters!','#F59E0B'); return; }
    rows.forEach(r => selectedIds.add(r.id));
    renderClassTable();
    showToast(`Selected ${rows.length} record${rows.length>1?'s':''} for bulk action`);
}

export function clearSelection() {
    const selectedIds = getSelectedIds();
    if (!selectedIds.size) { showToast('No records selected.','#94A3B8'); return; }
    const count = selectedIds.size;
    selectedIds.clear();
    renderClassTable();
    showToast(`Cleared ${count} selection${count>1?'s':''}`, '#94A3B8');
}

export async function deleteSelected() {
    let db = getDb();
    const selectedIds = getSelectedIds();
    const ids = [...selectedIds];
    if (!ids.length) { showToast('No records selected!','#F59E0B'); return; }
    if (!confirm(`Delete ${ids.length} selected record${ids.length>1?'s':''}?`)) return;
    db = db.filter(s => !ids.includes(s.id));
    selectedIds.clear();
    try {
        await deleteMany(ids);
        await syncToLocalStorage();
        saveBackupToDisk(db).catch(()=>{});
        import('./form.js').then(m => { m.setDb(db); m.setSelectedIds(selectedIds); });
    } catch(e) { showToast('Storage error!','#EF4444'); }
    renderClassTable(); updateDashboard(); showToast(`Deleted ${ids.length} record${ids.length>1?'s':''}!`);
}

export function openBulkEdit() {
    const selectedIds = getSelectedIds();
    const ids = [...selectedIds];
    if (!ids.length) { showToast('No records selected!','#F59E0B'); return; }
    document.getElementById('bulkEditModal').style.display = 'flex';
}

export async function applyBulkEdit() {
    let db = getDb();
    const selectedIds = getSelectedIds();
    const ids = [...selectedIds];
    const fields = ['CLASS','DIVISION','ACADEMIC_YEAR','GENDER','APL_BPL','HOSTEL_STUDENT','ORPHAN','VOC_CURRENT_YR','VOC_NAME_CURRENT','DOA'];
    let changed = 0;
    fields.forEach(f => {
        const val = document.getElementById('bulk-'+f).value;
        if (!val) return;
        db.forEach(s => {
            if (ids.includes(s.id)) { s[f] = val; changed++; }
        });
    });
    if (!changed) { showToast('No changes applied (select values to change).','#F59E0B'); return; }
    db.forEach(s => {
        if (!ids.includes(s.id)) return;
        if (s.VOC_NAME_CURRENT && s.VOC_CURRENT_YR === 'No') { s.VOC_CURRENT_YR = 'Yes'; changed++; }
    });
    try { await upsertMany(db.filter(s => ids.includes(s.id))); await syncToLocalStorage(); saveBackupToDisk(db).catch(()=>{}); } catch(e) { showToast('Storage error!','#EF4444'); }
    document.getElementById('bulkEditModal').style.display = 'none';
    renderClassTable(); updateDashboard(); showToast(`Updated ${changed} fields across ${ids.length} records!`);
}

export async function autoAllotRollNumbers() {
    let db = getDb();
    if (!db.length) { showToast('No records to allot!','#F59E0B'); return; }
    if (!confirm('This will reassign all roll numbers (Female A-Z first, then Male A-Z) per Class+Division. Continue?')) return;
    const groups = {};
    db.forEach(s => {
        const key = (s.CLASS||'') + '|' + (s.DIVISION||'');
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
    });
    Object.values(groups).forEach(group => {
        group.sort((a, b) => {
            if ((a.GENDER||'') !== (b.GENDER||'')) return a.GENDER === 'Female' ? -1 : 1;
            return (a.STUDENT_NAME||'').toLowerCase().localeCompare((b.STUDENT_NAME||'').toLowerCase());
        });
        group.forEach((s, i) => { s.ROLL_NO = (i + 1).toString(); });
    });
    try { await upsertMany(db); await syncToLocalStorage(); saveBackupToDisk(db).catch(()=>{}); } catch(e) { showToast('Storage full!','#EF4444'); }
    renderClassTable(); updateDashboard(); showToast('Roll numbers allotted successfully!');
}
