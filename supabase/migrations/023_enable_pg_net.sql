-- Enable pg_net extension for HTTP requests from PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_net;

COMMENT ON EXTENSION pg_net IS 'PostgreSQL extension for making HTTP requests from database functions';

