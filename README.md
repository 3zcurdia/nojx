# NoJX

Webscrapping without JS, just an api call

In multiple occasions, I have found myself in need of a web scrapper. However, in today’s digital landscape, every webpage contains some form of JavaScript, making it more complex to run a simple web crawler like those used in the past. Regardless of the programming language, I require a way to wait until the JavaScript is loaded. Consequently, a solution like Selenium emerges, which is an excellent tool. However, it is a dependency that necessitates a headless browser, typically Chrome. This, in turn, increases the server requirements, as running a headless browser consumes significant resources and can be costly. Additionally, these tools are primarily designed for testing purposes, rendering most of their features redundant.

Despite my personal preference for JavaScript, I must acknowledge the importance of its ecosystem. In this case, one of the best tools for web scraping is Puppeteer. This library does not require any configuration to interact with the browser, making it an ideal fit for this project. We can scrape HTML from any language and render the entire DOM on a browser, thereby reducing the load on other resources in a project that requires such tasks.

As an initial version, NoJX will simply return the DOM and a screenshot, as that is what is currently needed.
