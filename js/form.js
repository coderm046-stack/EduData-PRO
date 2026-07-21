import { FIELDS, getCurrentAcademicYear, normaliseDropdownValue, setSelectValue, showToast, toggleVoc, NORM_FIELDS, YN_FIELDS } from './utils.js';
import { saveRecord, deleteRecord, loadAll, syncToLocalStorage, saveBackupToDisk } from './db.js';
import { getCurrentUser } from './auth.js';
import { updateDashboard, setFormDirty } from './app.js';

let db = [];
let selectedIds = new Set();

export function setDb(d) { db = d; }
export function getDb() { return db; }
export function getSelectedIds() { return selectedIds; }
export function setSelectedIds(s) { selectedIds = s; }

export function resetApp() {
    document.getElementById('studentForm').reset();
    document.querySelectorAll('.section-body.collapsed').forEach(b => {
        b.classList.remove('collapsed');
        b.previousElementSibling.querySelector('.section-chevron')?.classList.add('open');
    });
    document.getElementById('ACADEMIC_YEAR').value = getCurrentAcademicYear();
    document.getElementById('photo-preview').innerHTML = '<span>3.5 x 4.5 cm Photo<br>Required</span>';
    document.getElementById('photoBase64').value = '';
    document.getElementById('editID').value = '';
    toggleVoc();
    document.getElementById('saveBtn').style.display = 'flex';
    document.getElementById('updateBtn').style.display = 'none';
    setFormDirty(false);
}

export async function handleSave() {
    const editId = parseInt(document.getElementById('editID').value) || 0;
    const aadharVal = document.getElementById('AADHAR_NO').value.trim();
    if (aadharVal && db.some(s => s.AADHAR_NO === aadharVal && s.id !== editId)) {
        showToast('Warning: Aadhar number already exists!', '#F59E0B');
    }
    const rollVal = document.getElementById('ROLL_NO').value.trim();
    const classVal = document.getElementById('CLASS').value;
    const divVal = document.getElementById('DIVISION').value;
    if (rollVal && classVal && db.some(s => s.ROLL_NO === rollVal && s.CLASS === classVal && s.DIVISION === divVal && s.id !== editId)) {
        showToast('Warning: Roll No already exists in this class/division!', '#F59E0B');
    }
    const record = { id: Date.now(), photo: document.getElementById('photoBase64').value };
    FIELDS.forEach(f => { if (document.getElementById(f)) record[f] = document.getElementById(f).value; });
    if (!record['ROLL_NO'] || record['ROLL_NO'] === '') {
        record['ROLL_NO'] = (Math.max(0, ...db.map(s => parseInt(s.ROLL_NO) || 0)) + 1).toString();
    }
    NORM_FIELDS.forEach(f => {
        if (record[f] !== undefined) record[f] = normaliseDropdownValue(f, record[f]);
    });
    db.push(record);
    try { await saveRecord(record); await syncToLocalStorage(); saveBackupToDisk(db).catch(()=>{}); } catch(e) { showToast('Storage full! Export backup and clear data.', '#EF4444'); }
    resetApp();
    showToast('✅ Saved!', '#10B981');
    updateDashboard();
}

export function startEdit(id) {
    const s = db.find(x => x.id === id);
    const selectFields = ['CLASS','ACADEMIC_YEAR','DIVISION','GENDER','HOSTEL_STUDENT','BLOOD_GROUP','ORPHAN','APL_BPL','VOC_CURRENT_YR'];
    FIELDS.forEach(f => {
        const el = document.getElementById(f);
        if (!el) return;
        const val = s[f] !== undefined && s[f] !== null ? s[f] : '';
        if (selectFields.includes(f)) setSelectValue(f, val);
        else el.value = val;
    });
    if (s.photo) {
        document.getElementById('photo-preview').innerHTML = `<img src="${s.photo}">`;
        document.getElementById('photoBase64').value = s.photo;
    }
    document.getElementById('editID').value = id;
    document.getElementById('saveBtn').style.display = 'none';
    document.getElementById('updateBtn').style.display = 'flex';
    toggleVoc();
    document.querySelectorAll('.section-body.collapsed').forEach(b => {
        b.classList.remove('collapsed');
        b.previousElementSibling.querySelector('.section-chevron')?.classList.add('open');
    });
    setFormDirty(false);
    closeSearch(); window.scrollTo(0, 0);
}

export async function handleUpdate() {
    const id = parseInt(document.getElementById('editID').value);
    const aadharVal = document.getElementById('AADHAR_NO').value.trim();
    if (aadharVal && db.some(s => s.AADHAR_NO === aadharVal && s.id !== id)) {
        showToast('Warning: Aadhar number already exists!', '#F59E0B');
    }
    const rollVal = document.getElementById('ROLL_NO').value.trim();
    const classVal = document.getElementById('CLASS').value;
    const divVal = document.getElementById('DIVISION').value;
    if (rollVal && classVal && db.some(s => s.ROLL_NO === rollVal && s.CLASS === classVal && s.DIVISION === divVal && s.id !== id)) {
        showToast('Warning: Roll No already exists in this class/division!', '#F59E0B');
    }
    const index = db.findIndex(s => s.id === id);
    if (index === -1) { showToast('Record not found', '#EF4444'); return; }
    NORM_FIELDS.forEach(f => {
        if (!document.getElementById(f)) return;
        const raw = document.getElementById(f).value;
        db[index][f] = normaliseDropdownValue(f, raw);
    });
    FIELDS.forEach(f => {
        if (NORM_FIELDS.includes(f)) return;
        const el = document.getElementById(f);
        if (el) db[index][f] = el.value;
    });
    db[index].photo = document.getElementById('photoBase64').value;
    try { await saveRecord(db[index]); await syncToLocalStorage(); saveBackupToDisk(db).catch(()=>{}); } catch(e) { showToast('Storage full! Export backup and clear data.', '#EF4444'); }
    resetApp();
    showToast('✅ Updated!', '#10B981');
    updateDashboard();
}

export async function handleDelete(id) {
    if (!confirm('Delete this student record?')) return;
    db = db.filter(s => s.id !== id);
    try { await deleteRecord(id); await syncToLocalStorage(); saveBackupToDisk(db).catch(()=>{}); } catch(e) { showToast('Storage full! Export backup and clear data.', '#EF4444'); }
    performSearch(); updateDashboard();
}

export async function wipeDatabase() {
    const code = Math.floor(1000 + Math.random()*9000);
    if (prompt(`Enter ${code} to confirm wiping ALL data:`) == code) {
        db = [];
        try { await import('./db.js').then(m => m.clearAll()); await syncToLocalStorage(); import('./db.js').then(m => m.saveBackupToDisk(db).catch(()=>{})); } catch(e) { showToast('Storage full! Export backup and clear data.', '#EF4444'); }
        showToast('🗑️ All data wiped', '#EF4444'); updateDashboard();
    }
}

export function openSearch() { document.getElementById('searchModal').style.display = 'flex'; performSearch(); }
export function closeSearch() { document.getElementById('searchModal').style.display = 'none'; }

export function performSearch() {
    const q = document.getElementById('searchInput').value.toLowerCase();
    const cf = document.getElementById('classFilter').value;
    const filtered = db.filter(r =>
        (!cf || r.CLASS === cf) &&
        ((r.STUDENT_NAME||'').toLowerCase().includes(q) || (r.ROLL_NO||'').toString().includes(q))
    );
    document.getElementById('searchResults').innerHTML = filtered.map(r => `
        <div class="search-item">
            <strong>${esc(r.STUDENT_NAME||'-')}</strong> &nbsp;(Roll: ${esc(r.ROLL_NO||'-')})<br>
            Class: ${esc(r.CLASS||'-')} &nbsp;|&nbsp; Year: ${esc(r.ACADEMIC_YEAR||'-')}
            <div style="display:flex;gap:5px;margin-top:5px;">
                <button style="flex:1;background:var(--warning);color:white;border:none;padding:8px;border-radius:5px;" onclick="import('./form.js').then(m => m.startEdit(${r.id}))">Edit</button>
                <button style="flex:1;background:var(--primary);color:white;border:none;padding:8px;border-radius:5px;" onclick="import('./form.js').then(m => m.printRecord(${r.id}))">Print</button>
                <button style="flex:1;background:var(--error);color:white;border:none;padding:8px;border-radius:5px;" onclick="import('./form.js').then(m => m.handleDelete(${r.id}))">Del</button>
            </div>
        </div>
    `).join('') || '<p class="search-empty">No records found.</p>';
}

function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

export function printRecord(id) {
    const s = db.find(x => x.id === id);
    if (!s) { showToast('Record not found', '#EF4444'); return; }
    document.getElementById('printArea').innerHTML = buildStudentPageHTML(s, false);
    setTimeout(() => window.print(), 100);
}

export function printAll() {
    if (!db.length) { showToast('No records to print!', '#F59E0B'); return; }
    if (!confirm(`Print ALL ${db.length} student form(s)?\nThis may take a moment for large batches.`)) return;
    showToast(`⏳ Preparing ${db.length} pages...`, '#1E3A8A');
    setTimeout(() => {
        document.getElementById('printArea').innerHTML = db.map((s, i) => buildStudentPageHTML(s, i < db.length - 1)).join('');
        setTimeout(() => window.print(), 200);
    }, 300);
}

function buildStudentPageHTML(s, addBreak) {
    const { formatDate, FIELDS } = window.__utils || {};
    const academicYear = s.ACADEMIC_YEAR || '-';
    const numRows = Math.ceil(FIELDS.length / 3);
    const breakClass = addBreak ? ' print-page-break' : '';
    const dateFields = ['DOA','DOB_LC','DOB_AADHAR'];
    const photoHtml = s.photo
        ? `<img src="${s.photo}" class="print-photo">`
        : `<div class="print-photo-placeholder">AFFIX<br>PHOTO</div>`;
    const cells = FIELDS.map(f => {
        const val = dateFields.includes(f) ? formatDate(s[f]) : (s[f] || '-');
        return `
        <div class="print-cell">
            <span class="print-label">${f.replace(/_/g,' ')}</span>
            <span class="print-value">${val}</span>
        </div>`;
    }).join('');
    return `
    <div class="print-page${breakClass}">
        <div class="print-header">
            <div class="print-header-text">
                <h1>Student Admission Record</h1>
                <p>&#128197; Academic Year: ${academicYear}</p>
            </div>
            ${photoHtml}
        </div>
        <div class="print-grid" style="grid-template-rows:repeat(${numRows},1fr);">
            ${cells}
        </div>
        <div class="footer-sign">Headmaster's Signature</div>
    </div>`;
}

export function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            applyPhoto(canvas);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function applyPhoto(srcCanvas) {
    const outW = 350, outH = 450;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext('2d');
    const sAspect = srcCanvas.width / srcCanvas.height;
    const dAspect = outW / outH;
    let sx = 0, sy = 0, sWidth = srcCanvas.width, sHeight = srcCanvas.height;
    if (sAspect > dAspect) {
        sWidth = srcCanvas.height * dAspect;
        sx = (srcCanvas.width - sWidth) / 2;
    } else {
        sHeight = srcCanvas.width / dAspect;
        sy = (srcCanvas.height - sHeight) / 2;
    }
    outCtx.drawImage(srcCanvas, sx, sy, sWidth, sHeight, 0, 0, outW, outH);
    const base64 = outCanvas.toDataURL('image/jpeg', 0.85);
    document.getElementById('photo-preview').innerHTML = '<img src="' + base64 + '">';
    document.getElementById('photoBase64').value = base64;
    showToast('Photo applied (350x450)', '#10B981');
}

let mediaStream = null;
let currentFacing = 'environment';

export function startCamera() { openCamera(currentFacing); }

async function openCamera(facing) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Camera API not supported. Use Gallery instead.', '#EF4444');
        return;
    }
    try {
        if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); }
        const constraints = {
            video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
            audio: false
        };
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        document.getElementById('camVideo').srcObject = mediaStream;
        document.getElementById('cameraModal').style.display = 'flex';
    } catch (err) {
        showToast('Camera not available. Use Gallery instead.', '#EF4444');
    }
}

export function closeCamera() {
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
    document.getElementById('cameraModal').style.display = 'none';
}

export function switchCamera() {
    currentFacing = currentFacing === 'environment' ? 'user' : 'environment';
    openCamera(currentFacing);
}

export async function capturePhoto() {
    const video = document.getElementById('camVideo');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    canvas.getContext('2d').drawImage(video, 0, 0);
    closeCamera();
    applyPhoto(canvas);
}
