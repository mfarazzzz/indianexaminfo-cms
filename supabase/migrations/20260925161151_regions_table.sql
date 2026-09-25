create table if not exists regions (
  slug  text primary key,
  label text not null,
  kind  text not null check (kind in ('state','ut','national')),
  created_at timestamptz not null default now()
);

comment on table regions is
  'Controlled list of India states + union territories + all-india. exams.region FKs here. The CMS region picker and state-page labels read it.';

insert into regions (slug, label, kind) values
  ('all-india',                                    'All India',                                   'national'),
  ('andhra-pradesh',                               'Andhra Pradesh',                              'state'),
  ('arunachal-pradesh',                            'Arunachal Pradesh',                           'state'),
  ('assam',                                        'Assam',                                       'state'),
  ('bihar',                                        'Bihar',                                       'state'),
  ('chhattisgarh',                                 'Chhattisgarh',                                'state'),
  ('goa',                                          'Goa',                                         'state'),
  ('gujarat',                                      'Gujarat',                                     'state'),
  ('haryana',                                      'Haryana',                                     'state'),
  ('himachal-pradesh',                             'Himachal Pradesh',                            'state'),
  ('jharkhand',                                    'Jharkhand',                                   'state'),
  ('karnataka',                                    'Karnataka',                                   'state'),
  ('kerala',                                       'Kerala',                                      'state'),
  ('madhya-pradesh',                               'Madhya Pradesh',                              'state'),
  ('maharashtra',                                  'Maharashtra',                                 'state'),
  ('manipur',                                      'Manipur',                                     'state'),
  ('meghalaya',                                    'Meghalaya',                                   'state'),
  ('mizoram',                                      'Mizoram',                                     'state'),
  ('nagaland',                                     'Nagaland',                                    'state'),
  ('odisha',                                       'Odisha',                                      'state'),
  ('punjab',                                       'Punjab',                                      'state'),
  ('rajasthan',                                    'Rajasthan',                                   'state'),
  ('sikkim',                                       'Sikkim',                                      'state'),
  ('tamil-nadu',                                   'Tamil Nadu',                                  'state'),
  ('telangana',                                    'Telangana',                                   'state'),
  ('tripura',                                      'Tripura',                                     'state'),
  ('uttar-pradesh',                                'Uttar Pradesh',                               'state'),
  ('uttarakhand',                                  'Uttarakhand',                                 'state'),
  ('west-bengal',                                  'West Bengal',                                 'state'),
  ('andaman-and-nicobar-islands',                  'Andaman and Nicobar Islands',                 'ut'),
  ('chandigarh',                                   'Chandigarh',                                  'ut'),
  ('dadra-and-nagar-haveli-and-daman-and-diu',     'Dadra and Nagar Haveli and Daman and Diu',    'ut'),
  ('delhi',                                        'Delhi',                                       'ut'),
  ('jammu-kashmir',                                'Jammu and Kashmir',                           'ut'),
  ('ladakh',                                       'Ladakh',                                      'ut'),
  ('lakshadweep',                                  'Lakshadweep',                                 'ut'),
  ('puducherry',                                   'Puducherry',                                  'ut')
on conflict (slug) do nothing;

alter table regions enable row level security;

drop policy if exists regions_read on regions;
create policy regions_read on regions for select using (true);
