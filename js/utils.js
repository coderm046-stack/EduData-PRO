export const FIELDS = [
    "CLASS","ACADEMIC_YEAR","DIVISION","ROLL_NO","GR_NO","STUDENT_NAME",
    "DOA","PREV_SCHOOL","GENDER","DOB_LC","POB","CASTE",
    "AADHAR_NO","NAME_AADHAR","DOB_AADHAR","FATHER_NAME","MOTHER_NAME",
    "MOBILE_1","MOBILE_2","EMAIL_ID","ADDRESS",
    "BANK_ACC","BANK_NAME","IFSC","PEN","APAAR",
    "HOSTEL_STUDENT","BLOOD_GROUP","HEIGHT","WEIGHT",
    "PERCENTAGE","DISTANCE","ORPHAN","APL_BPL",
    "REMARK","VOC_STATUS","VOC_CURRENT_YR","VOC_NAME","VOC_NAME_CURRENT"
];

export const COLUMN_MAP = [
    { field: 'CLASS', label: 'Class' }, { field: 'DIVISION', label: 'Division' },
    { field: 'ROLL_NO', label: 'Roll No' }, { field: 'GR_NO', label: 'GR No' },
    { field: 'STUDENT_NAME', label: 'Student Name' }, { field: 'DOA', label: 'DOA' },
    { field: 'PREV_SCHOOL', label: 'Prev School' }, { field: 'GENDER', label: 'Gender' },
    { field: 'DOB_LC', label: 'DOB' }, { field: 'POB', label: 'POB' },
    { field: 'CASTE', label: 'Caste' }, { field: 'AADHAR_NO', label: 'Aadhar' },
    { field: 'NAME_AADHAR', label: 'Name on Aadhar' }, { field: 'DOB_AADHAR', label: 'DOB on Aadhar' },
    { field: 'FATHER_NAME', label: 'Father' }, { field: 'MOTHER_NAME', label: 'Mother' },
    { field: 'MOBILE_1', label: 'Mobile 1' }, { field: 'MOBILE_2', label: 'Mobile 2' },
    { field: 'EMAIL_ID', label: 'Email' }, { field: 'ADDRESS', label: 'Address' },
    { field: 'BANK_ACC', label: 'Bank Acc' }, { field: 'BANK_NAME', label: 'Bank Name' },
    { field: 'IFSC', label: 'IFSC' }, { field: 'PEN', label: 'PEN' },
    { field: 'APAAR', label: 'APAAR' }, { field: 'BLOOD_GROUP', label: 'Blood Grp' },
    { field: 'HEIGHT', label: 'Height' }, { field: 'WEIGHT', label: 'Weight' },
    { field: 'PERCENTAGE', label: 'Last Class %' }, { field: 'DISTANCE', label: 'Distance' },
    { field: 'ORPHAN', label: 'Orphan' }, { field: 'HOSTEL_STUDENT', label: 'Hostel' },
    { field: 'APL_BPL', label: 'APL/BPL' }, { field: 'REMARK', label: 'Remark' },
    { field: 'VOC_STATUS', label: 'Voc. at Xth' }, { field: 'VOC_CURRENT_YR', label: 'Voc. Current Yr' },
    { field: 'VOC_NAME', label: 'Voc Subject (Xth)' }, { field: 'VOC_NAME_CURRENT', label: 'Voc Subject (Current)' },
    { field: 'ACADEMIC_YEAR', label: 'Acad. Year' }
];

export function formatDate(val) {
    if (!val) return '-';
    const parts = String(val).split('-');
    if (parts.length !== 3) return val;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
}

export function esc(str) {
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export function getCurrentAcademicYear() {
    const d = new Date();
    const y = d.getFullYear();
    return d.getMonth() >= 3 ? `${y}-${y+1}` : `${y-1}-${y}`;
}

export function normaliseDropdownValue(field, raw) {
    const v = String(raw||'').trim().toUpperCase();
    if (field === 'GENDER') {
        if (['MALE','M','BOY','1'].includes(v)) return 'Male';
        if (['FEMALE','F','GIRL','2'].includes(v)) return 'Female';
        return raw||'';
    }
    const ynF = ['HOSTEL_STUDENT','ORPHAN','VOC_STATUS','VOC_CURRENT_YR'];
    if (ynF.includes(field)) {
        if (['YES','Y','TRUE','1'].includes(v)) return 'Yes';
        if (['NO','N','FALSE','0',''].includes(v)||!v) return 'No';
        return raw||'No';
    }
    if (field === 'CLASS') {
        if (['9','IX','CLASS9','CLASS IX','STD9','STD IX'].includes(v)) return 'IX';
        if (['10','X','CLASS10','CLASS X','STD10','STD X'].includes(v)) return 'X';
        if (['11','XI','CLASS11','CLASS XI','STD11','STD XI'].includes(v)) return 'XI';
        if (['12','XII','CLASS12','CLASS XII','STD12','STD XII'].includes(v)) return 'XII';
        return raw||'';
    }
    if (field === 'APL_BPL') {
        if (v==='BPL') return 'BPL';
        return raw||'APL';
    }
    if (field === 'BLOOD_GROUP') {
        const clean = v.replace(/\s/g,'');
        return ['A+','A-','B+','B-','AB+','AB-','O+','O-'].includes(clean) ? clean : (raw||'');
    }
    if (field === 'DIVISION') return v ? v : (raw||'');
    return raw||'';
}

export function setSelectValue(id, val) {
    const el = document.getElementById(id);
    if (!el || el.tagName !== 'SELECT') return;
    if (val && Array.from(el.options).every(o => o.value !== val)) {
        const opt = document.createElement('option');
        opt.value = val; opt.textContent = val;
        el.appendChild(opt);
    }
    el.value = val||'';
}

export function showToast(m, c='#10B981') {
    const t = document.getElementById('toast');
    t.textContent = m; t.style.background = c; t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3500);
}

export function toggleSection(el) {
    const body = el.nextElementSibling;
    const chevron = el.querySelector('.section-chevron');
    if (body && body.classList.contains('section-body')) {
        body.classList.toggle('collapsed');
        if (chevron) chevron.classList.toggle('open');
    }
}

export function toggleVoc() {
    document.getElementById('vocBox').style.display = document.getElementById('VOC_STATUS').value === 'Yes' ? 'block' : 'none';
    document.getElementById('vocBoxCurrent').style.display = document.getElementById('VOC_CURRENT_YR').value === 'Yes' ? 'block' : 'none';
}

export const DATE_FIELDS = ['DOA','DOB_LC','DOB_AADHAR'];

export function getFilteredRows(db) {
    const fCls    = document.getElementById('tbl-class').value;
    const fDiv    = document.getElementById('tbl-div').value;
    const fYear   = document.getElementById('tbl-year').value;
    const fGender = document.getElementById('tbl-gender').value;
    const fVoc    = document.getElementById('tbl-voc').value;
    const fVocCur = document.getElementById('tbl-voc-current').value;
    const fVocSub = document.getElementById('tbl-voc-subject-current').value;
    const fOrphan = document.getElementById('tbl-orphan').value;
    const fHostel = document.getElementById('tbl-hostel').value;
    const fApl    = document.getElementById('tbl-aplbpl').value;
    return db.filter(s => {
        if (fCls    && s.CLASS         !== fCls)    return false;
        if (fDiv    && s.DIVISION       !== fDiv)    return false;
        if (fYear   && s.ACADEMIC_YEAR !== fYear)   return false;
        if (fGender && s.GENDER        !== fGender) return false;
        if (fVoc    && s.VOC_STATUS    !== fVoc)    return false;
        if (fVocCur && s.VOC_CURRENT_YR !== fVocCur) return false;
        if (fVocSub && s.VOC_NAME_CURRENT !== fVocSub) return false;
        if (fOrphan && s.ORPHAN        !== fOrphan) return false;
        if (fHostel && (fHostel === 'Yes') !== (s.HOSTEL_STUDENT === 'Yes')) return false;
        if (fApl    && s.APL_BPL       !== fApl)    return false;
        return true;
    });
}

export const NORM_FIELDS = ['GENDER','HOSTEL_STUDENT','ORPHAN','VOC_STATUS','VOC_CURRENT_YR','CLASS','APL_BPL','BLOOD_GROUP','DIVISION','ACADEMIC_YEAR'];
export const YN_FIELDS = ['HOSTEL_STUDENT','ORPHAN','VOC_STATUS','VOC_CURRENT_YR'];
