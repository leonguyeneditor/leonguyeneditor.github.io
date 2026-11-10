# Reset Journal · Demo

A trading journal you can try right in your browser. Log trades with chart screenshots and drawings, review your days, and see how well you follow your plan.

> **This is a demo.** Everything you enter is saved **only in your own browser** (IndexedDB). Nothing is sent online and nobody else can see it. Clearing browser data or using a private window starts you with an empty journal.

Static site: no server, no build step. `local-api.js` plays the role of the server inside the browser.

| File | What it does |
|---|---|
| `index.html` | Page structure |
| `style.css` | Design, light/dark mode, mobile layout |
| `script.js` | All pages and interactions |
| `i18n.js` | Language switcher (English, Tiếng Việt, Español, Português, Bahasa Indonesia) |
| `local-api.js` | Saves data in the browser |
