import { esc } from './utils.js';
import { getDb } from './form.js';

export function renderDashboard() {
    let db = getDb();
    const fYear  = document.getElementById('dashboardYearFilter').value;
    const fCls   = document.getElementById('dashboardClassFilter').value;
    const fDiv   = document.getElementById('dashboardDivFilter').value;

    let total = 0, boys = 0, girls = 0, orphan = 0, voc = 0, hostel = 0, bpl = 0;
    const bgCounts = { 'A+':0,'A-':0,'B+':0,'B-':0,'AB+':0,'AB-':0,'O+':0,'O-':0 };
    const classData = {};
    const vocSubs = {};

    db.forEach(s => {
        if (fYear && s.ACADEMIC_YEAR !== fYear) return;
        if (fCls  && s.CLASS         !== fCls)  return;
        if (fDiv  && s.DIVISION      !== fDiv)  return;

        total++;
        if (s.GENDER === 'Male') boys++;
        else if (s.GENDER === 'Female') girls++;
        if (s.ORPHAN === 'Yes') orphan++;
        if (s.VOC_CURRENT_YR === 'Yes') voc++;
        if (s.HOSTEL_STUDENT === 'Yes') hostel++;
        if (s.APL_BPL === 'BPL') bpl++;

        const bg = s.BLOOD_GROUP;
        if (bg && bg in bgCounts) bgCounts[bg]++;

        const cls = s.CLASS || '';
        if (!classData[cls]) classData[cls] = { t:0,b:0,g:0,o:0,v:0,h:0,p:0 };
        const d = classData[cls];
        d.t++;
        if (s.GENDER === 'Male') d.b++;
        else if (s.GENDER === 'Female') d.g++;
        if (s.ORPHAN === 'Yes') d.o++;
        if (s.VOC_CURRENT_YR === 'Yes') d.v++;
        if (s.HOSTEL_STUDENT === 'Yes') d.h++;
        if (s.APL_BPL === 'BPL') d.p++;

        if (s.VOC_CURRENT_YR === 'Yes' && s.VOC_NAME_CURRENT) {
            const k = s.VOC_NAME_CURRENT.trim().toUpperCase() || 'UNKNOWN';
            vocSubs[k] = (vocSubs[k] || 0) + 1;
        }
    });

    document.getElementById('d-total').textContent  = total;
    document.getElementById('d-boys').textContent   = boys;
    document.getElementById('d-girls').textContent  = girls;
    document.getElementById('d-orphan').textContent = orphan;
    document.getElementById('d-voc').textContent    = voc;
    document.getElementById('d-hostel').textContent = hostel;
    document.getElementById('d-bpl').textContent    = bpl;

    const years = fYear ? [fYear] : [...new Set(db.map(s => s.ACADEMIC_YEAR).filter(Boolean))].sort();
    const classes = fCls ? [fCls] : ['IX','X','XI','XII'];
    if (years.length) {
        let cyHtml = '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;"><thead><tr style="background:var(--primary-light);">';
        cyHtml += '<th style="padding:8px;border:1px solid var(--border);text-align:left;color:var(--primary);">Class</th>';
        years.forEach(y => { cyHtml += `<th style="padding:8px;border:1px solid var(--border);text-align:center;color:var(--primary);">${esc(y)}</th>`; });
        cyHtml += '</tr></thead><tbody>';
        classes.forEach((cls,ci) => {
            const hasData = db.some(s => s.CLASS === cls && (!fYear || s.ACADEMIC_YEAR === fYear) && (!fDiv || s.DIVISION === fDiv));
            if (!hasData) return;
            cyHtml += `<tr class="${ci%2===0?'row-even':'row-odd'}"><td class="dash-cell dash-class" style="font-weight:700;">Class ${cls}</td>`;
            years.forEach(y => {
                const cnt = db.filter(s => s.CLASS === cls && s.ACADEMIC_YEAR === y && (!fDiv || s.DIVISION === fDiv)).length;
                cyHtml += `<td class="dash-cell dash-center dash-bold">${cnt||'-'}</td>`;
            });
            cyHtml += '</tr>';
        });
        cyHtml += '</tbody></table>';
        document.getElementById('d-cross-year').innerHTML = cyHtml;
    } else {
        document.getElementById('d-cross-year').innerHTML = '<p class="tbl-empty">No data yet.</p>';
    }

    const clsColors = ['#2563EB','#059669','#7C3AED','#DC2626'];
    document.getElementById('d-classrows').innerHTML =
        classes.map((cls,ci) => {
            const d = classData[cls];
            if (!d) return '';
            return `<tr class="${ci%2===0?'row-even':'row-odd'}">
                <td class="dash-cell dash-class" style="color:${clsColors[ci]}">Class ${cls}</td>
                <td class="dash-cell dash-center dash-bold">${d.t}</td>
                <td class="dash-cell dash-center dash-bold" style="color:#0369a1">${d.b}</td>
                <td class="dash-cell dash-center dash-bold" style="color:#be185d">${d.g}</td>
                <td class="dash-cell dash-center">${d.o}</td>
                <td class="dash-cell dash-center">${d.v}</td>
                <td class="dash-cell dash-center">${d.h}</td>
                <td class="dash-cell dash-center">${d.p}</td>
            </tr>`;
        }).join('') ||
        `<tr><td colspan="8" class="tbl-empty">No records yet.</td></tr>`;

    const bloods = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
    const bgColors = ['#2563EB','#3b82f6','#059669','#10b981','#7C3AED','#8b5cf6','#DC2626','#f87171'];
    const bCounts = bloods.map(bg => bgCounts[bg]);
    const bMax = Math.max(1, ...bCounts);
    document.getElementById('d-blood').innerHTML = bloods.map((bg,i) =>
        `<div class="d-bar-row">
            <span class="d-bar-label">${bg}</span>
            <div class="d-bar-track"><div class="d-bar-fill" style="width:${Math.round(bCounts[i]/bMax*100)}%;background:${bgColors[i]};"></div></div>
            <span class="d-bar-count">${bCounts[i]}</span>
        </div>`).join('');

    const apl = total - bpl;
    const abMax = Math.max(1, apl, bpl);
    document.getElementById('d-aplbpl').innerHTML =
        `<div class="d-bar-row"><span class="d-bar-label">APL</span><div class="d-bar-track"><div class="d-bar-fill" style="width:${Math.round(apl/abMax*100)}%;background:#2563EB;"></div></div><span class="d-bar-count">${apl}</span></div>
        <div class="d-bar-row"><span class="d-bar-label">BPL</span><div class="d-bar-track"><div class="d-bar-fill" style="width:${Math.round(bpl/abMax*100)}%;background:#DC2626;"></div></div><span class="d-bar-count">${bpl}</span></div>`;

    const vocEntries = Object.entries(vocSubs).sort((a,b)=>b[1]-a[1]);
    const vsMax = vocEntries.length ? vocEntries[0][1] : 1;
    const vsColors = ['#2563EB','#059669','#7C3AED','#DC2626','#d97706','#0891b2'];
    document.getElementById('d-vocsubjects').innerHTML = vocEntries.length
        ? vocEntries.map(([sub,cnt],i) =>
            `<div class="d-bar-row">
                <span class="d-bar-label" style="min-width:80px;font-size:0.7rem;text-align:right;">${sub.length>10?esc(sub.slice(0,10))+'…':esc(sub)}</span>
                <div class="d-bar-track"><div class="d-bar-fill" style="width:${Math.round(cnt/vsMax*100)}%;background:${vsColors[i%6]};"></div></div>
                <span class="d-bar-count">${cnt}</span>
            </div>`).join('')
        : '<p class="voc-empty">No vocational students yet.</p>';
}
