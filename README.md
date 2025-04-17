# 🧰 NoJX

🕸️ Webscrapping without JS, just an api call or a CLI command.

In multiple occasions, I have found myself in need of a web scrapper. However, in today’s digital landscape, every webpage contains some form of JavaScript, making it more complex to run a simple web crawler like those used in the past. Regardless of the programming language, I require a way to wait until the JavaScript is loaded. Consequently, a solution like Selenium emerges, which is an excellent tool. However, it is a dependency that necessitates a headless browser, typically Chrome. This, in turn, increases the server requirements, as running a headless browser consumes significant resources and can be costly. Additionally, these tools are primarily designed for testing purposes, rendering most of their features redundant.

Despite my personal preference for JavaScript, I must acknowledge the importance of its ecosystem. In this case, one of the best tools for web scraping is Puppeteer. This library does not require any configuration to interact with the browser, making it an ideal fit for this project. We can scrape HTML from any language and render the entire DOM on a browser, thereby reducing the load on other resources in a project that requires such tasks.

As an initial version, NoJX will simply return the html processed content, color histogram and a screenshot on the api version.

### 📦 Install (CLI)

```bash
npm install -g nojx
```

---

### 🚀 Usage

#### CLI

```bash
nojx <url> [--colors]
```

##### Examples

```bash
nojx https://example.com
# → prints HTML content of the page

nojx https://example.com --colors
# → prints the dominant colors from the page as JSON
```

#### Local API

Start the Express server:

```bash
nojx server
```

Endpoints available:

- `GET /api/up` → health check
- `POST /api/fetch` → `{ url }` → returns `{ html, colors }`
- `POST /api/screenshot` → `{ url }` → returns image (screenshot)

---

### 🌐 Hosted API (via Vercel)

You can use the hosted version at, hoever for large pages it might fail due the timeout limit of 60 seconds of vercel

```
https://nojx-page.vercel.app/
```

#### Example Request

```bash
curl -X POST https://nojx-page.vercel.app/api/fetch \
  -H "Content-Type: application/json" \
  -d '{"url": "https://news.ycombinator.com"}'
```

---

### 🧱 Use Cases

- Scraping HTML for content or SEO
- Extracting color palettes from websites
- Automating screenshots for visual diffs
- CLI + API convenience for scripting or pipelines

---

### 📦 Dev / Contributing

```bash
npm install
npm link   # to test CLI as `nojx`
```
