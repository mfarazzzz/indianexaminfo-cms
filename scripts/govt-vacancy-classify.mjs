import fs from 'node:fs';

// 100 exams where pillar='govt-vacancy' (from live SQL 2026-09-28, editions all =1)
const exams = [
  ['ap-village-revenue-officer-2026','AP Village Revenue Officer (VRO)','irregular'],
  ['army-rally-bihar-2026','Indian Army Rally Bihar','biannual'],
  ['army-rally-mp-2026','Indian Army Rally MP','biannual'],
  ['army-rally-rajasthan-2026','Indian Army Rally Rajasthan','biannual'],
  ['army-rally-up-2026','Indian Army Rally UP (Agnipath)','biannual'],
  ['assam-grade-iii-2026','Assam Direct Recruitment Grade III','irregular'],
  ['assam-grade-iv-2026','Assam Direct Recruitment Grade IV','irregular'],
  ['assam-tet-teacher-2026','Assam TET Teacher Recruitment','irregular'],
  ['bihar-amin-2026','Bihar Amin (Revenue Staff)','irregular'],
  ['bihar-anganwadi-2026','Bihar Anganwadi Sevika/Sahayika Recruitment','irregular'],
  ['bihar-anm-2026','Bihar SHSB ANM/Staff Nurse Recruitment','irregular'],
  ['bihar-court-clerk-2026','Bihar District Court Clerk/Peon','irregular'],
  ['bihar-home-guard-2026','Bihar Home Guard Recruitment','irregular'],
  ['bihar-nagar-nigam-2026','Bihar Nagar Nigam Various Posts','irregular'],
  ['bihar-panchayat-sachiv-2026','Bihar Panchayat Sachiv (Secretary)','irregular'],
  ['bihar-roadways-driver-2026','BSRTC Driver/Conductor','irregular'],
  ['bihar-stet-teacher-2026','Bihar BPSC Teacher (TRE)','irregular'],
  ['cg-forest-guard-2026','CG Forest Guard (Van Pariveshak)','irregular'],
  ['cg-nhm-2026','Chhattisgarh NHM Health Worker','irregular'],
  ['cg-patwari-2026','Chhattisgarh Patwari (Revenue Inspector)','irregular'],
  ['cg-police-constable-2026','Chhattisgarh Police Constable','irregular'],
  ['cg-teacher-2026','CG Vyapam Shikshak (Teacher)','irregular'],
  ['ecce-educator-rampur','ECCE Educator-Rampur','irregular'],
  ['gujarat-bin-sachivalay-2026','Gujarat Bin Sachivalay Clerk','irregular'],
  ['gujarat-talati-2026','Gujarat Talati cum Mantri (Village Accountant)','irregular'],
  ['gujarat-tat-teacher-2026','Gujarat TAT Teacher Recruitment','irregular'],
  ['haryana-clerk-2026','Haryana HSSC Clerk/DEO Recruitment','irregular'],
  ['haryana-police-constable-2026','Haryana Police Constable','irregular'],
  ['hp-tet-teacher-2026','HP TET Teacher Recruitment','irregular'],
  ['india-post-gds-2026','India Post GDS (Gramin Dak Sevak)','annual'],
  ['india-post-mts-2026','India Post MTS (Multi-Tasking Staff)','irregular'],
  ['india-post-postman-2026','India Post Postman/Mail Guard','irregular'],
  ['jharkhand-police-2026','Jharkhand Police Constable/SI','irregular'],
  ['jharkhand-teacher-2026','Jharkhand JSSC Teacher','irregular'],
  ['karnataka-fda-sda-2026','Karnataka FDA/SDA (First/Second Division Asst)','annual'],
  ['karnataka-pdo-2026','Karnataka PDO (Panchayat Development Officer)','irregular'],
  ['kerala-ldc-2026','Kerala PSC LDC (Lower Division Clerk)','annual'],
  ['maharashtra-arogya-sevak-2026','Maharashtra Arogya Sevak/Sevika','irregular'],
  ['maharashtra-gram-sevak-2026','Maharashtra Gram Sevak (ZP)','irregular'],
  ['maharashtra-police-bharti-2026','Maharashtra Police Constable','irregular'],
  ['maharashtra-talathi-2026','Maharashtra Talathi (Revenue Clerk)','irregular'],
  ['maharashtra-zp-health-2026','Maharashtra ZP Health Department (Various)','irregular'],
  ['mp-anganwadi-worker-2026','MP Anganwadi Supervisor/Worker Recruitment','irregular'],
  ['mp-court-staff-2026','MP High Court Staff (Stenographer/DEO)','irregular'],
  ['mp-forest-guard-2026','MP Forest Guard (Van Rakshak)','irregular'],
  ['mp-group-5-sub-engineer-2026','MP Vyapam Group 5 Sub-Engineer','irregular'],
  ['mp-home-guard-2026','MP Home Guard Recruitment','irregular'],
  ['mp-mahila-supervisor-2026','MP Mahila Supervisor (WCD)','irregular'],
  ['mp-nhm-staff-2026','MP NHM Staff Nurse/ANM/Lab Tech','irregular'],
  ['mp-panchayat-secretary-2026','MP Panchayat Secretary (Gram Panchayat Sachiv)','irregular'],
  ['mp-patwari-2026','MP Patwari Recruitment','irregular'],
  ['mp-samvida-shala-varg-3','MP Samvida Shala Shikshak Varg 3','irregular'],
  ['mpeb-lineman-2026','MPEB Line Attendant/Technician','irregular'],
  ['odisha-asha-worker-2026','Odisha ASHA Worker/NHM Staff','irregular'],
  ['odisha-police-constable-2026','Odisha Police Constable (Civil/Armed)','irregular'],
  ['odisha-teacher-2026','Odisha CT/BEd Teacher Recruitment','irregular'],
  ['punjab-police-constable-2026','Punjab Police Constable','irregular'],
  ['rajasthan-3rd-grade-teacher','Rajasthan 3rd Grade Teacher','irregular'],
  ['rajasthan-anganwadi-2026','Rajasthan Anganwadi Worker Recruitment','irregular'],
  ['rajasthan-computer-instructor-2026','Rajasthan Computer Instructor (RKCL)','irregular'],
  ['rajasthan-forest-guard-2026','Rajasthan Forest Guard/Forester','irregular'],
  ['rajasthan-gram-sevak-2026','Rajasthan Gram Sevak Recruitment','irregular'],
  ['rajasthan-home-guard-2026','Rajasthan Home Guard Recruitment','irregular'],
  ['rajasthan-nagar-palika-2026','Rajasthan Nagar Palika Recruitment','irregular'],
  ['rajasthan-nhm-cho-2026','Rajasthan NHM CHO/Staff Nurse','irregular'],
  ['rajasthan-patwari-2026','Rajasthan Patwari Recruitment','irregular'],
  ['rajasthan-rsmssb-lab-asst-2026','RSMSSB Lab Assistant','irregular'],
  ['rajasthan-vidyut-helper-2026','Rajasthan Vidyut Vibhag Helper/Technician','irregular'],
  ['telangana-constable-2026','Telangana Police Constable (TSLPRB)','irregular'],
  ['tn-mrb-nurse-2026','Tamil Nadu MRB Staff Nurse/Health Inspector','irregular'],
  ['tn-police-constable-2026','Tamil Nadu Police Constable','irregular'],
  ['tn-si-2026','Tamil Nadu Police SI (TNUSRB)','irregular'],
  ['uk-forest-guard-2026','Uttarakhand Forest Guard (Van Daroga)','irregular'],
  ['uk-police-constable-2026','Uttarakhand Police Constable','irregular'],
  ['uksssc-group-c-scaler','UKSSSC Group C Scaler Recruitment','annual'],
  ['up-anganwadi-worker-2026','UP Anganwadi Worker/Helper Recruitment','irregular'],
  ['up-assistant-accountant-2026','UP Sahayak Lekhakar (Assistant Accountant)','irregular'],
  ['up-bal-vikas-seva-2026','UP Bal Vikas Seva Pushtahar Vibhag','irregular'],
  ['up-cooperative-bank-2026','UP District Cooperative Bank Clerk','irregular'],
  ['up-court-peon-2026','UP District Court Peon/Process Server','irregular'],
  ['up-fireman-2026','UP Fire Service (Daman Karmchari)','irregular'],
  ['up-forest-guard-2026','UP Forest Guard/Wildlife Guard','irregular'],
  ['up-gram-vikas-adhikari-2026','UP Gram Vikas Adhikari (VDO)','irregular'],
  ['up-home-guard-2026','UP Home Guard Recruitment','irregular'],
  ['up-iti-instructor-2026','UP ITI Instructor/Workshop Attendant','irregular'],
  ['up-jail-warder-2026','UP Jail Warder/Fireman Recruitment','irregular'],
  ['up-junior-assistant-2026','UP Junior Assistant/Stenographer','irregular'],
  ['up-krishi-sevak-2026','UP Krishi Technical Sahayak','irregular'],
  ['up-lekhpal-bharti-2026','UP Revenue Lekhpal Bharti','irregular'],
  ['up-nhn-cho-2026','UP NHM Community Health Officer','irregular'],
  ['up-roadways-conductor-2026','UPSRTC Conductor/Driver Recruitment','irregular'],
  ['up-safai-karmi-2026','UP Safai Karmi Recruitment','irregular'],
  ['up-shikshamitra-2026','UP Sahayak Adhyapak (Assistant Teacher)','irregular'],
  ['up-special-police-2026','UP Special Police Officer (SPO)','irregular'],
  ['up-swasthya-vibhag-2026','UP Swasthya Vibhag (Health Dept) Recruitment','irregular'],
  ['uppcl-technician-2026','UPPCL Technician (Electrical)','irregular'],
  ['wb-anganwadi-2026','West Bengal Anganwadi Worker/Helper','irregular'],
  ['wb-group-d-2026','WB Group D (WBSSC)','irregular'],
  ['wb-primary-teacher-2026','WB Primary Teacher (TET)','irregular'],
  ['wb-swasthya-karmi-2026','WB State Health Recruitment (WBHRB)','irregular'],
];
if (exams.length !== 100) throw new Error('expected 100 exams, got ' + exams.length);

// GSC clicks by final path segment (attrition like vacancy-tables.md §3)
const csv = fs.readFileSync('docs/seo/gsc-pages-2026-09-27.csv', 'utf8').trim().split(/\r?\n/).slice(1);
const clicksBySeg = new Map();
for (const line of csv) {
  const cols = line.split(',');
  const path = cols[2];
  const clicks = parseInt(cols[3], 10);
  const seg = path.replace(/\?.*$/, '').split('/').filter(Boolean).pop();
  clicksBySeg.set(seg, (clicksBySeg.get(seg) || 0) + (isNaN(clicks) ? 0 : clicks));
}

// recurring = more than one edition, OR a real periodic cycle_frequency (not 'irregular'/null)
const RECURRING_FREQ = new Set(['annual','biannual','half-yearly','quarterly','monthly','weekly','biennial']);
const rows = exams.map(([slug, name, freq]) => {
  const editions = 1; // verified: every govt-vacancy exam has exactly 1 edition
  const recurring = editions > 1 || (freq && RECURRING_FREQ.has(freq));
  const cls = recurring ? 'recurring' : 'single';
  const clicks = clicksBySeg.get(slug) || 0;
  return { slug, name, editions, freq, cls, clicks };
});

// emit CSV
const esc = (s) => /[",]/.test(s) ? '"' + String(s).replace(/"/g, '""') + '"' : s;
const out = ['slug,name,editions_count,cycle_frequency,gsc_clicks,classification'];
for (const r of rows) out.push([r.slug, esc(r.name), r.editions, r.freq, r.clicks, r.cls].join(','));
fs.writeFileSync('docs/design/govt-vacancy-classification.csv', out.join('\n') + '\n');

// report
const rec = rows.filter(r => r.cls === 'recurring');
const sing = rows.filter(r => r.cls === 'single');
const sum = (a) => a.reduce((s, r) => s + r.clicks, 0);
console.log('total rows:', rows.length);
console.log('recurring:', rec.length, '(clicks ' + sum(rec) + ')');
console.log('single   :', sing.length, '(clicks ' + sum(sing) + ')');
console.log('rows with any GSC click:', rows.filter(r => r.clicks > 0).map(r => `${r.slug}=${r.clicks} [${r.cls}]`).join(', ') || 'none');
