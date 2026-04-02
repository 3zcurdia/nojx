# AGENTS.md - Coding Guidelines for NoJX

## Build/Lint/Format Commands

```bash
# Install dependencies
npm install

# Link CLI for local testing
npm link

# Lint code
npm run lint

# Lint and auto-fix issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check
```

**Note:** There is no test suite configured. To add tests, use a framework like Jest, Vitest, or Node.js built-in test runner.

## Project Structure

```
nojx/
├── api/           # Vercel serverless API handlers
├── bin/           # CLI entry point (cli.js)
├── lib/           # Core business logic (core.js)
├── src/           # Server setup (server.js)
├── public/        # Static assets
└── package.json   # Dependencies and scripts
```

## Code Style Guidelines

### Language & Modules

- Use ES modules (import/export) exclusively
- Set type: module in package.json (already configured)
- Use latest ECMAScript features (ES2022+)

### Formatting (Prettier)

- 2-space indentation
- Single quotes for strings
- Semicolons required
- No trailing commas (in line with existing code)
- Line width: ~80-100 characters

### Naming Conventions

- camelCase for variables and functions
- PascalCase for classes (if any)
- UPPER_CASE for constants
- Use descriptive names (e.g., initBrowser, getPageData)

### Import Organization

1. External dependencies first
2. Internal modules second
3. Separate groups with blank lines

Example:

```javascript
import express from "express";
import puppeteer from "puppeteer";

import { initBrowser } from "../lib/core.js";
import fetchHandler from "../api/fetch.js";
```

### Error Handling

- Use try/catch for async operations
- Always clean up resources (close browsers, pages)
- Log errors with console.error
- Return meaningful error messages in API responses
- Use retry logic for flaky operations (browser initialization)

### API Handlers

- Export as default async function
- Use Express req/res pattern
- Return JSON with appropriate HTTP status codes
- Validate required parameters early
- Structure: validation → try/catch → cleanup → response

### Browser Automation

- Always set viewport dimensions
- Set user agent string to avoid detection
- Use appropriate wait conditions (networkidle2, domcontentloaded)
- Close pages after use to prevent memory leaks
- Handle browser disconnection events

### CLI Patterns

- Use process.argv for argument parsing
- Support both long and short commands (server/s)
- Exit with code 1 on errors
- Output to stdout (results) and stderr (errors)

### Security Considerations

- Never expose secrets in code
- Validate all user inputs (URLs)
- Use sandbox mode for browser
- Set reasonable timeouts (default: 15000ms)

### Environment Handling

- Check NODE_ENV for production vs development
- Use different browser configs per environment
- Production: Use @sparticuz/chromium with puppeteer-core
- Development: Use standard puppeteer

### Comments

- Avoid redundant comments
- Explain WHY not WHAT for complex logic
- Remove commented-out code before committing
