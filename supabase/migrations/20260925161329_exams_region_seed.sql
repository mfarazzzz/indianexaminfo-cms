create table if not exists region_seed_backup_20260713000021 as
  select id, slug, region from exams;

update exams set region = 'uttar-pradesh' where slug in (
  'uppsc-pcs','uppsc-ro-aro','upsssc-lekhpal','upsssc-pet','up-police-constable','super-tet',
  'up-judiciary-pcs-j','up-bed-jee',
  'up-gram-vikas-adhikari-2026','up-krishi-sevak-2026','up-anganwadi-worker-2026',
  'up-forest-guard-2026','up-nhn-cho-2026','up-swasthya-vibhag-2026','up-court-peon-2026',
  'up-fireman-2026','up-junior-assistant-2026','up-safai-karmi-2026','up-home-guard-2026',
  'up-jail-warder-2026','up-special-police-2026','uppcl-technician-2026',
  'up-assistant-accountant-2026','up-lekhpal-bharti-2026','up-bal-vikas-seva-2026',
  'up-iti-instructor-2026','up-shikshamitra-2026','up-cooperative-bank-2026',
  'army-rally-up-2026','up-roadways-conductor-2026',
  'up-board-class-10','up-board-class-12',
  'mjpru-exam','aktu-exam','ddu-gorakhpur-exam','lucknow-university-exam',
  'ccs-university-meerut','amity-entrance'
);
update exams set region = 'rajasthan' where slug in (
  'rpsc-ras','rajasthan-police-constable',
  'rajasthan-gram-sevak-2026','rajasthan-anganwadi-2026','rajasthan-forest-guard-2026',
  'rajasthan-nhm-cho-2026','rajasthan-nagar-palika-2026','rajasthan-rsmssb-lab-asst-2026',
  'rajasthan-home-guard-2026','rajasthan-vidyut-helper-2026','rajasthan-patwari-2026',
  'rajasthan-3rd-grade-teacher','rajasthan-computer-instructor-2026','army-rally-rajasthan-2026',
  'rajasthan-jet','rajasthan-university-exam','mgsu-bikaner-exam','rtu-kota-exam','bits-pilani-exam',
  'rajasthan-board-class-10','rajasthan-board-class-12'
);
update exams set region = 'madhya-pradesh' where slug in (
  'mppsc','mp-police-constable','mppeb-group-5','mp-judiciary',
  'mp-panchayat-secretary-2026','mp-anganwadi-worker-2026','mp-nhm-staff-2026',
  'mp-forest-guard-2026','mp-court-staff-2026','mp-home-guard-2026',
  'mp-group-5-sub-engineer-2026','mpeb-lineman-2026','mp-patwari-2026',
  'mp-mahila-supervisor-2026','mp-samvida-shala-varg-3','army-rally-mp-2026',
  'mp-board-class-10','mp-board-class-12'
);
update exams set region = 'bihar' where slug in (
  'bpsc','bihar-police-constable',
  'bihar-panchayat-sachiv-2026','bihar-anganwadi-2026','bihar-anm-2026','bihar-court-clerk-2026',
  'bihar-nagar-nigam-2026','bihar-home-guard-2026','bihar-stet-teacher-2026','bihar-amin-2026',
  'bihar-roadways-driver-2026','army-rally-bihar-2026',
  'bihar-board-inter','bihar-board-matric',
  'magadh-university-exam','patna-university-exam','lalit-narayan-mithila-exam'
);
update exams set region = 'maharashtra' where slug in (
  'maharashtra-gram-sevak-2026','maharashtra-arogya-sevak-2026','maharashtra-zp-health-2026',
  'maharashtra-police-bharti-2026','maharashtra-talathi-2026',
  'maharashtra-hsc','maharashtra-ssc',
  'mht-cet','mah-mba-cet','mh-cet-law','mah-mca-cet',
  'mumbai-university-exam','pune-university-exam'
);
update exams set region = 'tamil-nadu' where slug in (
  'tnpsc-group-1','tn-mrb-nurse-2026','tn-police-constable-2026','tn-si-2026',
  'tn-board-class-10','tn-board-class-12','tancet',
  'anna-university-exam','madras-university-exam','vit-viteee','srm-entrance'
);
update exams set region = 'karnataka' where slug in (
  'kpsc','karnataka-pdo-2026','karnataka-fda-sda-2026',
  'kcet','comedk-uget','kmat','karnataka-puc','karnataka-sslc',
  'bangalore-university-exam','vtu-exam','manipal-entrance'
);
update exams set region = 'west-bengal' where slug in (
  'wbpsc','wbp-constable','wb-anganwadi-2026','wb-swasthya-karmi-2026','wb-group-d-2026',
  'wb-primary-teacher-2026','wb-madhyamik','wb-uchcha-madhyamik','wbjee','wbjee-jeca',
  'calutta-university-exam','nsou-exam'
);
update exams set region = 'telangana' where slug in (
  'tspsc-group-1','telangana-constable-2026','ts-board-class-10',
  'ts-eapcet','ts-icet','ts-lawcet',
  'osmania-university-exam','jntuh-exam','braou-exam'
);
update exams set region = 'andhra-pradesh' where slug in (
  'appsc-group-1','ap-village-revenue-officer-2026','ap-board-class-10',
  'ap-eapcet','ap-icet','ap-lawcet'
);
update exams set region = 'gujarat' where slug in (
  'gpsc','gujarat-bin-sachivalay-2026','gujarat-talati-2026','gujarat-tat-teacher-2026',
  'gujarat-board-class-10','gujarat-board-class-12','gujcet','gujarat-university-exam'
);
update exams set region = 'haryana' where slug in (
  'hpsc-hcs','haryana-clerk-2026','haryana-police-constable-2026',
  'haryana-board-class-10','haryana-board-class-12',
  'mdu-rohtak-exam','kuk-kurukshetra-exam','hau-entrance'
);
update exams set region = 'jharkhand' where slug in (
  'jpsc','jharkhand-police-2026','jharkhand-teacher-2026',
  'jharkhand-board-class-10','jharkhand-board-class-12','ranchi-university-exam'
);
update exams set region = 'chhattisgarh' where slug in (
  'cgpsc','cg-forest-guard-2026','cg-nhm-2026','cg-police-constable-2026','cg-patwari-2026',
  'cg-teacher-2026','cg-board-class-10','cg-board-class-12','cg-pet','cg-pre-agri'
);
update exams set region = 'odisha' where slug in (
  'opsc-oas','osssc-ri-amin','odisha-asha-worker-2026','odisha-police-constable-2026',
  'odisha-teacher-2026','ojee','ouat'
);
update exams set region = 'punjab' where slug in (
  'ppsc-pcs','punjab-police-constable-2026','punjab-board-class-10','punjab-board-class-12'
);
update exams set region = 'uttarakhand' where slug in (
  'ukpsc','uk-forest-guard-2026','uksssc-group-c-scaler','uk-police-constable-2026',
  'uk-board-class-10','uk-board-class-12'
);
update exams set region = 'delhi' where slug in (
  'dsssb-teacher','delhi-judiciary','ssc-constable-gd-2','ssc-head-constable'
);
update exams set region = 'assam' where slug in (
  'assam-police-si','assam-grade-iii-2026','assam-grade-iv-2026','assam-tet-teacher-2026','assam-cee'
);
update exams set region = 'kerala' where slug in (
  'kerala-ldc-2026','kerala-hse','kerala-sslc','keam','klee'
);
update exams set region = 'himachal-pradesh' where slug in (
  'hp-police-constable','hp-tet-teacher-2026','hp-cet','hpu-mat'
);
update exams set region = 'jammu-kashmir' where slug in (
  'jk-cet'
);
update exams set region = 'chandigarh' where slug in (
  'pu-cet-ug','pu-cet-pg'
);
update exams set region = 'all-india' where region is null;;
