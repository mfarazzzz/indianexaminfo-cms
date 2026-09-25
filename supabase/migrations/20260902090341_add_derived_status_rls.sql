
-- Grant anon/authenticated read on the view so PostgREST and the frontend can query it
ALTER VIEW exam_derived_status OWNER TO postgres;
GRANT SELECT ON exam_derived_status TO anon, authenticated;
;
