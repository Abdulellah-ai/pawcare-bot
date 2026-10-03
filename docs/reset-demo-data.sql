-- Wipes ALL demo/test data so the dashboard starts empty. Keeps: bot_config_versions (style/knowledge), admin user, secrets.
-- Run as the project owner (Supabase SQL editor / MCP). Also delete the staff-group topics (see tools/reset-topics.cjs).
delete from public.bookings;
delete from public.handoffs;
delete from public.messages;
delete from public.inbound_updates;
delete from public.conversations;
delete from public.customers;
delete from public.error_log;
delete from public.audit_log where table_name in ('customers','conversations','bookings','handoffs');
