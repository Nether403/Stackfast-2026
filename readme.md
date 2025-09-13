# Stackfast - AI-Powered Tech Stack Builder

## Overview
Stackfast is a comprehensive platform for discovering AI development tools, analyzing compatibility, building tech stacks, and generating project blueprints. Born from the merger of TechStack Explorer and StackFast, it provides intelligent recommendations, harmony scoring, migration planning, and analytics to help developers create optimal stacks.

Key features:
- Curated database of 51+ tools with add/edit/delete and fuzzy search
- Compatibility matrix with heatmap, insights, and migration wizard
- Stack builder with validation, recommendations, saving/loading, and export (JSON/CSV)
- AI-like blueprint generation with compatibility awareness
- Analytics dashboard with charts and stats
- User voting for dynamic popularity scores
- External data imports and API integrations

Live Demo: [stackfast-demo.vercel.app](https://stackfast-demo.vercel.app) (See DEMO.md for walkthrough)

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **UI**: shadcn/ui, Radix UI, Tailwind CSS (dark theme with neon orange accents)
- **State**: TanStack Query
- **Build**: Vite
- **Key Pages**: Dashboard, Tool Database (paginated/fuzzy search), Stack Builder (with export/save), Compatibility Matrix (virtualized), Blueprint Builder, Analytics, Migration Wizard

### Backend
- **Runtime**: Node.js/Express with TypeScript
- **API**: RESTful, split into modular routes (tools, categories, etc.)
- **Database**: PostgreSQL with Drizzle ORM
- **Services**: Compatibility engine, blueprint generator, external imports (GitHub, npm, etc.)
- **Security**: Rate limiting (100 req/15min), caching

### Database
- Tables: tools, categories, compatibilities, junctions for multi-category
- Features: JSONB for flexible data, migrations via Drizzle Kit

## API Endpoints (Selected)
- `/api/tools`: CRUD for tools
- `/api/v1/compatibility/:toolA/:toolB`: Score between tools
- `/api/v1/stack/analyze`: Stack harmony analysis
- `/api/v1/tools/search`: Fuzzy/filtered search
- `/api/v1/blueprint`: Generate blueprint
- `/api/v1/migration/:from/:to`: Migration paths
- `/api/tools/:id/vote`: Update popularity (new)

Full list in routes files.

## Setup
1. Install: `npm install`
2. Database: Set up PostgreSQL, run migrations `npx drizzle-kit push:pg`
3. Env: Copy .env.example to .env and fill keys
4. Run: `npm run dev` (frontend + backend)
5. Import Data: POST to /api/tools/import-stackfast and /api/tools/import-csv

## Usage
- Explore tools and vote on popularity
- Build/analyze stacks with exports
- Generate blueprints for ideas
- View compatibility in matrix/heatmap

## Recent Changes
- Added pagination, fuzzy search, voting, saved stacks, exports
- Virtualized matrix for performance
- Expanded to 51+ tools via imports
- Rate limiting and route modularization
- Dependency updates

See CODEBASE_REVIEW.md for full audit.
