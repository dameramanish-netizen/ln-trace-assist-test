# LN Trace Assist — chat bot widget

A single-file, self-contained chat bot that wraps the logic of your three tools:

- **Trace Debugger** — keyword / DAL-error search + call-stack reconstruction
- **Trace Compare** — side-by-side clickable call-tree explorer for two traces
- **Performance Check** — pairs entry/exit lines by timestamp to flag slow calls

It's pure client-side JavaScript — no server, no API, no cost. Trace files are
parsed entirely in the visitor's browser and are never uploaded anywhere,
which also makes it safe for sensitive ERP logs.

## How to add it to your GitHub Pages site

1. Copy `ln-trace-bot.js` into your `infor-LN-Trace-Assist` repo (e.g. into a
   `/assets/` folder).
2. In your site's HTML (e.g. `index.html`), add this line right before the
   closing `</body>` tag:

   ```html
   <script src="assets/ln-trace-bot.js" defer></script>
   ```

3. Commit and push. A small chat bubble (`ln>`) will appear in the
   bottom-right corner of every page that includes the script. Clicking it
   opens the assistant.

That's it — no build step, no npm install, no backend to deploy or pay for.

## Optional: change the title

Before the script tag, you can set:

```html
<script>window.LTB_CONFIG = { title: "My Custom Bot Name" };</script>
<script src="assets/ln-trace-bot.js" defer></script>
```

## Notes on parity with the original tools

- **File types**: Debugger & Performance Check accept `.txt`, `.log`, `.gz`.
  Compare additionally accepts `.zip` (first `.txt`/`.log` file inside is used),
  matching the original apps.
- **Large files**: gzip decompression uses the `pako` library and zip
  extraction uses `JSZip`, both loaded on-demand from a CDN the first time
  they're needed — so the base widget stays tiny until a user actually
  uploads a compressed file.
- **Result caps**: matches over 50,000 lines are capped (Debugger) and
  displayed tables are capped at 500 visible rows for browser performance,
  exactly mirroring the caps in your original Streamlit apps.
- The debug filter logic (DAL filter / depth filter / blacklist / keyword
  matching) and the performance stack-based duration calculation are ported
  line-for-line from your Python source, so results should match what the
  Streamlit apps produce for the same file.

## Testing it locally

Open `test.html` in this folder in any browser — it loads the widget on a
blank demo page so you can click through all three flows before publishing.
