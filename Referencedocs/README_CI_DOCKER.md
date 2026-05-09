# CI, Docker, and Environment Setup

## Environment

- Create `.env` at repo root:
```
PORT=5000
DATABASE_URL=postgres://user:pass@host/db
NODE_ENV=development
```

## Local Development

- Install deps: `npm install`
- Dev server (mem storage when no DB): `npm run dev`
- Build client+server: `npm run build`
- Start production server: `npm start`

## Docker

Create `Dockerfile` and `docker-compose.yml` if needed. Example:

Dockerfile
```
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=5000
EXPOSE 5000
CMD ["node","dist/index.js"]
```

## GitHub Actions (CI)

Add `.github/workflows/ci.yml`:
```
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run check
      - run: npm run build
```

