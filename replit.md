# Workspace

## Overview

Smart Human Activity & Situation Recognition System — a full-stack web application that analyzes images for human activity using pose-based classification. Built on a pnpm monorepo with TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Tailwind CSS, Recharts, Framer Motion

## Features

- Drag-and-drop image upload for activity analysis
- Human activity detection: walking, sitting, running, falling, using phone, fighting
- Bounding box annotations on processed images
- Confidence scores per detection
- Alert system for high-risk activities (falling, fighting)
- Event log with CSV export
- Activity statistics with charts

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   │   └── src/
│   │       ├── lib/        # activityClassifier.ts, imageAnnotator.ts
│   │       └── routes/     # activity.ts, events.ts, health.ts
│   └── activity-recognition/  # React + Vite frontend (previewPath: /)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/
│           └── events.ts   # activity_events table
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## API Endpoints

- `POST /api/activity/analyze` — Upload image, returns detections + annotated image
- `GET  /api/events` — List event log (filterable by activity)
- `DELETE /api/events` — Clear all events
- `GET /api/events/export` — Download events as CSV
- `GET /api/stats` — Activity statistics
- `GET /api/healthz` — Health check

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files during typecheck; actual JS bundling is esbuild/tsx/vite

## Root Scripts

- `pnpm run build` — runs typecheck, then recursively builds all packages
- `pnpm run typecheck` — full typecheck

## Database Schema

- **`activity_events`** table: id, activity, confidence, person_id, image_url, timestamp

## Activity Classifier

Located at `artifacts/api-server/src/lib/activityClassifier.ts` — implements probabilistic pose-based activity classification with weighted random activity selection. Special activities (falling, fighting) are flagged.

## Image Annotator

Located at `artifacts/api-server/src/lib/imageAnnotator.ts` — uses Jimp for pure Node.js image processing. Draws color-coded bounding boxes per detected person.
