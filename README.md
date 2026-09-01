# NoJX

Webscrapping without JS, just a CLI command.

In multiple occasions, I have found myself in need of a web scrapper. However, in today's digital landscape, every webpage contains some form of JavaScript, making it more complex to run a simple web crawler like those used in the past. Regardless of the programming language, I require a way to wait until the JavaScript is loaded. Consequently, a solution like Selenium emerges, which is an excellent tool. However, it is a dependency that necessitates a headless browser, typically Chrome. This, in turn, increases the server requirements, as running a headless browser consumes significant resources and can be costly. Additionally, these tools are primarily designed for testing purposes, rendering most of their features redundant.

Despite my personal preference for JavaScript, I must acknowledge the importance of its ecosystem. In this case, one of the best tools for web scraping is Puppeteer. This library does not require any configuration to interact with the browser, making it an ideal fit for this project. We can scrape HTML from any language and render the entire DOM on a browser, thereby reducing the load on other resources in a project that requires such tasks.

NoJX will return the HTML processed content, a color histogram, and structured JSON via declarative scraping after JS has executed.

### Install

```bash
npm install -g nojx
```

---

### Usage

```bash
nojx <url> [--colors]
nojx <url> --scrape '<jsonString>'
nojx <url> --scrape-file <path>
```

* `--colors` prints the dominant colors as JSON. Mutually exclusive with `--scrape` / `--scrape-file`.
* `--scrape` takes an inline JSON string describing selectors.
* `--scrape-file` takes a path to a JSON file with the same schema. Mutually exclusive with `--scrape`.

Output for scraping is always JSON (`stdout`) and suppresses HTML. Missing single values return `null`, missing lists return `[]`.

#### Examples

```bash
nojx https://example.com
# prints HTML content of the page

nojx https://example.com --colors
# prints the dominant colors from the page as JSON

nojx https://example.com --scrape '{"title":{"css":"h1","type":"value","value":"text"}}'
# {"title": "Hello"}

nojx https://example.com --scrape-file ./selectors.json
# same as above, but selectors loaded from file
```

### Scraping

Selectors are a JSON object where each key becomes a key in the output. Each value is a spec:

```json
{
  "key": {
    "css": "h1.page-title",
    "type": "value | list",
    "value": "text | html | attr:<name> | value",
    "attr": "href",
    "fields": { "<nestedKey>": { "css": "...", ... } }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `css` | yes | CSS selector, scoped to `document` at top level or to parent element when nested |
| `type` | no | `"value"` (single, default) returns first match or `null`; `"list"` returns all matches (`[]` if none) |
| `value` | no | Extraction mode, default `"text"`: `"text"` = `textContent.trim()`, `"html"` = `innerHTML`, `"attr:href"` = `getAttribute("href")`, `"attr"` + `"attr":"src"` = same, `"value"` = input value |
| `attr` | no | Attribute name when `value` is `"attr"` |
| `fields` | no | Nested object for structured extraction. When present, each parent match becomes an object. Supports deep nesting |

#### Product page example

`selectors.json`:

```json
{
  "title": { "css": "h1.page-title", "type": "value", "value": "text" },
  "price": { "css": ".price", "type": "value", "value": "text" },
  "image": { "css": ".product-image img", "type": "value", "value": "attr:src" },
  "description": { "css": ".description", "type": "value", "value": "html" },
  "breadcrumbs": { "css": ".breadcrumb a", "type": "list", "value": "text" },
  "related": {
    "css": ".related .product",
    "type": "list",
    "fields": {
      "name": { "css": ".name", "value": "text" },
      "price": { "css": ".price", "value": "text" },
      "url": { "css": "a", "value": "attr:href" }
    }
  }
}
```

```bash
nojx https://example.com/product/123 --scrape-file ./selectors.json
```

Output:

```json
{
  "title": "My Product",
  "price": "$19.99",
  "image": "https://example.com/img.jpg",
  "description": "<b>Bold</b> text",
  "breadcrumbs": ["Home", "Shop"],
  "related": [
    { "name": "Related 1", "price": "$9.99", "url": "/p/1" }
  ]
}
```

Notes:

* Child `css` inside `fields` is queried relative to each parent element, so `fields` can be nested arbitrarily.
* Use `type: "value"` with `fields` for a single nested object, `type: "list"` for an array of objects.
* On invalid JSON, missing `css`, or invalid `type` the CLI exits with code 1 and prints `Error:` to `stderr`.

---

### Use Cases

- Scraping HTML for content or SEO
- Extracting color palettes from websites
- Automating screenshots for visual diffs
- CLI convenience for scripting or pipelines

---

### Dev / Contributing

```bash
npm install
npm link   # to test CLI as `nojx`
```
