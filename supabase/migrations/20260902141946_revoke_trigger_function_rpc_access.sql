
-- notify_frontend_revalidate is a trigger function only.
-- It must not be callable as an RPC endpoint by any role.
REVOKE EXECUTE ON FUNCTION notify_frontend_revalidate() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION notify_frontend_revalidate() FROM anon;
REVOKE EXECUTE ON FUNCTION notify_frontend_revalidate() FROM authenticated;
;
