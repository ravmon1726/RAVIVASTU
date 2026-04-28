# Vastu Pro — 16-Zone Floor Plan Analyzer

## Overview
React + TypeScript + Vite app for analyzing floor plans against Vastu Shastra principles across 16 directional zones. Users upload or draw a floor plan, mark rooms, and the analyzer reports defects/recommendations. Supports PDF export and saving analyses to Supabase.

## Stack
- Vite + React 18 + TypeScript
- Tailwind CSS
- Supabase (`@supabase/supabase-js`) for persistence (table: `analyses`)
- jsPDF for PDF export
- lucide-react icons

## Project Structure
- `src/App.tsx` — main UI (Draw / Analyze / History tabs, canvas, zone overlay)
- `src/lib/vastu.ts` — Vastu zone logic & defect rules
- `src/lib/supabase.ts` — Supabase client
- `src/types.ts` — shared types (Room, Point, Defect, Severity, RoomType)
- `supabase/migrations/` — SQL migrations for the `analyses` table

## Environment
- Node.js 20 (installed as a Replit module)
- Env vars in `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Workflow
- `Start application` runs `npm run dev` on port 5000 (Vite configured with `host: 0.0.0.0`, `allowedHosts: true` for Replit's proxy preview).
