/*!
 * LN Trace Assist — embeddable chat bot widget
 * ---------------------------------------------
 * Wraps the logic of three tools into one in-chat assistant:
 *   1. Trace Debugger   — keyword/DAL-error search + call-stack reconstruction
 *   2. Trace Compare    — side-by-side clickable call-tree explorer for two traces
 *   3. Performance Check — pairs entry/exit lines by timestamp to flag slow calls
 *
 * 100% client-side. Trace files are parsed in the visitor's browser and are
 * never uploaded anywhere.
 *
 * EMBED: add this before </body> on any page:
 *   <script src="ln-trace-bot.js" defer></script>
 *
 * Optional config (set before the script tag loads):
 *   <script>window.LTB_CONFIG = { title: "LN Trace Assist" };</script>
 */
(function () {
  'use strict';

  var CONFIG = Object.assign({ title: 'LN Trace Assist' }, window.LTB_CONFIG || {});

  /* ============================== STYLES ============================== */

  var CSS = [
    '#ltb-root{position:fixed;inset:auto 20px 20px auto;z-index:999999;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}',
    '#ltb-launcher{width:56px;height:56px;border-radius:16px;border:1px solid #2A3B57;background:linear-gradient(160deg,#16213B,#0B1220);box-shadow:0 10px 30px rgba(0,0,0,.45);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:2px;transition:transform .15s ease,box-shadow .15s ease;}',
    '#ltb-launcher:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(0,0,0,.55);}',
    '.ltb-launcher-prompt{font-family:"JetBrains Mono",ui-monospace,Consolas,monospace;color:#F2A93C;font-weight:700;font-size:15px;}',
    '.ltb-cursor{width:8px;height:16px;background:#F2A93C;animation:ltb-blink 1s steps(1) infinite;border-radius:1px;}',
    '@keyframes ltb-blink{50%{opacity:0}}',
    '#ltb-panel{position:absolute;bottom:70px;right:0;width:400px;max-width:calc(100vw - 24px);height:620px;max-height:calc(100vh - 110px);background:#0B1220;border:1px solid #2A3B57;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.55);display:flex;flex-direction:column;overflow:hidden;}',
    '#ltb-panel.ltb-hidden{display:none;}',
    '#ltb-titlebar{display:flex;align-items:center;gap:8px;padding:12px 14px;background:#121B2E;border-bottom:1px solid #22314C;flex:0 0 auto;}',
    '.ltb-dot{width:9px;height:9px;border-radius:50%;display:inline-block;}',
    '.ltb-dot-red{background:#F87171}.ltb-dot-amber{background:#F2A93C}.ltb-dot-green{background:#34D399}',
    '.ltb-title{margin-left:6px;color:#E2E8F0;font-family:"JetBrains Mono",ui-monospace,Consolas,monospace;font-size:13px;font-weight:600;flex:1;}',
    '#ltb-restart,#ltb-close{background:transparent;border:none;color:#93A4C3;cursor:pointer;font-size:14px;padding:4px 6px;border-radius:6px;}',
    '#ltb-restart:hover,#ltb-close:hover{background:#1B2740;color:#E2E8F0;}',
    '#ltb-messages{flex:1 1 auto;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:radial-gradient(circle at 20% 0%,#0E1830 0%,#0B1220 60%);}',
    '#ltb-messages::-webkit-scrollbar{width:8px;}',
    '#ltb-messages::-webkit-scrollbar-thumb{background:#233252;border-radius:4px;}',
    '.ltb-msg{display:flex;}',
    '.ltb-msg-bot{justify-content:flex-start;}',
    '.ltb-msg-user{justify-content:flex-end;}',
    '.ltb-bubble{max-width:88%;}',
    '.ltb-msg-bot .ltb-bubble{background:#152036;border:1px solid #22314C;border-radius:12px 12px 12px 3px;padding:10px 12px;}',
    '.ltb-msg-user .ltb-bubble{background:#F2A93C;border-radius:12px 12px 3px 12px;padding:8px 12px;}',
    '.ltb-msg-user .ltb-text{color:#0B1220;font-weight:600;font-size:13px;}',
    '.ltb-text{color:#E2E8F0;font-size:13.5px;line-height:1.5;}',
    '.ltb-text code{background:#0B1220;border:1px solid #22314C;padding:1px 5px;border-radius:4px;font-family:"JetBrains Mono",Consolas,monospace;font-size:12px;color:#7DD3FC;}',
    '.ltb-quick-replies{display:flex;flex-wrap:wrap;gap:6px;}',
    '.ltb-chip{background:#152036;border:1px solid #2A3B57;color:#E2E8F0;padding:7px 12px;border-radius:999px;font-size:12.5px;cursor:pointer;transition:.15s;}',
    '.ltb-chip:hover:not(:disabled){border-color:#F2A93C;color:#F2A93C;}',
    '.ltb-chip:disabled{opacity:.4;cursor:default;}',
    '.ltb-config{background:#0F1729;border:1px solid #22314C;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:10px;}',
    '.ltb-field-label{color:#93A4C3;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;}',
    '.ltb-upload-btn{background:#1B2740;border:1px dashed #3A4E75;color:#E2E8F0;padding:10px 12px;border-radius:8px;cursor:pointer;font-size:13px;width:100%;text-align:center;}',
    '.ltb-upload-btn:hover{border-color:#F2A93C;color:#F2A93C;}',
    '.ltb-upload-status{display:block;margin-top:6px;font-size:11.5px;color:#93A4C3;font-family:"JetBrains Mono",Consolas,monospace;word-break:break-all;}',
    '.ltb-dropzone{display:block;}',
    '.ltb-checkbox{display:flex;align-items:center;gap:8px;color:#E2E8F0;font-size:13px;cursor:pointer;}',
    '.ltb-kw-list{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;}',
    '.ltb-kw-chip{background:#0C4A6E;border:1px solid #38BDF8;color:#7DD3FC;padding:4px 8px;border-radius:6px;font-family:"JetBrains Mono",Consolas,monospace;font-size:11.5px;cursor:pointer;}',
    '.ltb-kw-input{width:100%;box-sizing:border-box;background:#0B1220;border:1px solid #2A3B57;color:#E2E8F0;padding:8px 10px;border-radius:8px;font-size:13px;}',
    '.ltb-kw-input:focus{outline:none;border-color:#F2A93C;}',
    '.ltb-slider-wrap{display:flex;flex-direction:column;gap:6px;}',
    '.ltb-slider-label{color:#E2E8F0;font-size:12.5px;font-family:"JetBrains Mono",Consolas,monospace;}',
    '.ltb-btn{background:#1B2740;border:1px solid #2A3B57;color:#E2E8F0;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;align-self:flex-start;}',
    '.ltb-btn:hover{border-color:#F2A93C;}',
    '.ltb-btn-primary{background:#F2A93C;border-color:#F2A93C;color:#0B1220;}',
    '.ltb-btn-primary:hover{background:#F7BB63;}',
    '.ltb-table-wrap{max-height:260px;overflow:auto;border:1px solid #22314C;border-radius:8px;}',
    '.ltb-table{border-collapse:collapse;width:100%;font-size:12px;font-family:"JetBrains Mono",Consolas,monospace;}',
    '.ltb-table th{position:sticky;top:0;background:#152036;color:#93A4C3;text-align:left;padding:7px 9px;border-bottom:1px solid #22314C;white-space:nowrap;}',
    '.ltb-table td{padding:6px 9px;border-bottom:1px solid #182338;color:#E2E8F0;white-space:pre;}',
    '.ltb-row-clickable{cursor:pointer;}',
    '.ltb-row-clickable:hover td{background:#1B2740;}',
    '.ltb-pre{background:#0B1220;border:1px solid #22314C;border-radius:8px;padding:10px;font-family:"JetBrains Mono",Consolas,monospace;font-size:12px;color:#34D399;white-space:pre-wrap;word-break:break-word;max-height:280px;overflow:auto;}',
    '.ltb-empty{color:#93A4C3;font-size:12.5px;padding:8px 2px;}',
    '.ltb-compare-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}',
    '.ltb-compare-col{display:flex;flex-direction:column;gap:8px;}',
    '.ltb-compare-title{font-size:12px;font-weight:700;padding:5px 8px;border-radius:6px;text-align:center;}',
    '.ltb-compare-title-ok{background:rgba(52,211,153,.12);color:#34D399;border:1px solid rgba(52,211,153,.3);}',
    '.ltb-compare-title-bad{background:rgba(248,113,113,.12);color:#F87171;border:1px solid rgba(248,113,113,.3);}',
    '.ltb-explorer{background:#0F1729;border:1px solid #22314C;border-radius:8px;padding:8px;max-height:340px;overflow:auto;display:flex;flex-direction:column;gap:4px;}',
    '.ltb-tree-btn{width:100%;text-align:left;background:#1E293B;color:#34D399;border:1px solid #334155;border-left:3px solid #34D399;border-radius:6px;padding:6px 8px;font-family:"JetBrains Mono",Consolas,monospace;font-size:11.5px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.ltb-tree-btn:hover{background:#26344d;}',
    '.ltb-return-line{font-family:"JetBrains Mono",Consolas,monospace;font-size:11.5px;color:#38BDF8;background:#0C4A6E;padding:6px 8px;border-radius:6px;border-left:3px solid #38BDF8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.ltb-back-btn{align-self:flex-start;background:transparent;border:1px solid #334155;color:#93A4C3;padding:5px 10px;border-radius:6px;font-size:11.5px;cursor:pointer;margin-bottom:4px;}',
    '.ltb-back-btn:hover{color:#F2A93C;border-color:#F2A93C;}',
    '.ltb-anchor-card{background:#1E293B;border-top:3px solid #34D399;border-radius:8px;padding:8px;margin-bottom:6px;font-family:"JetBrains Mono",Consolas,monospace;font-size:11.5px;color:#E2E8F0;word-break:break-word;}',
    '.ltb-child-label{color:#93A4C3;font-size:11px;margin:2px 0 2px;text-transform:uppercase;letter-spacing:.03em;}',
    '.ltb-footer-note{color:#5B6C8F;font-size:10.5px;text-align:center;padding:6px 4px 0;}',
    '@media (max-width:480px){#ltb-panel{position:fixed;inset:0;width:100vw;height:100vh;max-width:100vw;max-height:100vh;border-radius:0;bottom:0;right:0;}#ltb-root{inset:auto 12px 12px auto;}.ltb-compare-grid{grid-template-columns:1fr;}}'
  ].join('\n');

  var styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ============================ LAZY LIBS =============================== */

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  var pakoPromise = null;
  function ensurePako() {
    if (window.pako) return Promise.resolve();
    if (!pakoPromise) pakoPromise = loadScript('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js');
    return pakoPromise;
  }
  var jszipPromise = null;
  function ensureJSZip() {
    if (window.JSZip) return Promise.resolve();
    if (!jszipPromise) jszipPromise = loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    return jszipPromise;
  }

  // Extracts the first text-like entry from a .zip into a small in-memory
  // "pseudo file" that still exposes .name/.stream() like a real File, so it
  // can flow through the same streaming code path as everything else.
  // (Zip files are fully buffered by JSZip itself, so this path is only
  // meant for small archives — use .gz for very large trace files.)
  async function extractZipAsPseudoFile(file) {
    await ensureJSZip();
    var buf = await file.arrayBuffer();
    var zip = await window.JSZip.loadAsync(buf);
    var names = Object.keys(zip.files).filter(function (n) {
      var f = zip.files[n];
      return !f.dir && (n.endsWith('.txt') || n.endsWith('.log') || n.indexOf('.') === -1);
    });
    if (!names.length) return null;
    var text = await zip.files[names[0]].async('string');
    var blob = new Blob([text], { type: 'text/plain' });
    return { name: names[0], size: blob.size, stream: function () { return blob.stream(); } };
  }

  // Incrementally inflates a gzip byte ReadableStream using pako, for
  // browsers without native DecompressionStream support.
  function pakoDecompressStream(byteStream) {
    return new ReadableStream({
      start: function (controller) {
        var inflator = new window.pako.Inflate();
        inflator.onData = function (chunk) { controller.enqueue(chunk); };
        inflator.onEnd = function () { controller.close(); };
        var reader = byteStream.getReader();
        function pump() {
          reader.read().then(function (res) {
            if (res.done) { inflator.push(new Uint8Array(0), true); return; }
            inflator.push(res.value, false);
            if (inflator.err) { controller.error(new Error(inflator.msg || 'Decompression error')); return; }
            pump();
          }).catch(function (e) { controller.error(e); });
        }
        pump();
      }
    });
  }

  // Streams a File (optionally gzip-compressed) and yields it line by line.
  // Never materializes the whole decompressed file as one buffer or string,
  // so file size is only limited by disk, not by the browser's ~1-2GB
  // ArrayBuffer/string ceiling.
  async function* streamLines(file) {
    var isGz = file.name.toLowerCase().endsWith('.gz');
    var byteStream = file.stream();
    if (isGz) {
      if (typeof DecompressionStream !== 'undefined') {
        byteStream = byteStream.pipeThrough(new DecompressionStream('gzip'));
      } else {
        await ensurePako();
        byteStream = pakoDecompressStream(byteStream);
      }
    }
    var reader = byteStream.getReader();
    var decoder = new TextDecoder('utf-8', { fatal: false });
    var buffer = '';
    while (true) {
      var res = await reader.read();
      if (res.done) {
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(res.value, { stream: true });
      var nl;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        var line = buffer.slice(0, nl);
        if (line.charAt(line.length - 1) === '\r') line = line.slice(0, -1);
        yield line;
        buffer = buffer.slice(nl + 1);
      }
    }
    if (buffer.length) yield buffer;
  }

  /* ============================== PARSERS ================================ */
  // Mirrors the three original Streamlit tools line for line.

  var BLACKLIST = ['ottstptcserver'];
  var TARGETS = ['dal.handle.field.error', '__dal.set.message(', 'form.text$('];

  function timeToMs(t) {
    var m = /(\d{2}):(\d{2}):(\d{2})\.(\d{3})/.exec(t);
    if (!m) return null;
    return (((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000) + (+m[4]);
  }

  // --- Performance Check ---
  // Streams the file line by line — memory is bounded by the current call
  // stack depth and the slow-call list, never by total file size.
  async function parsePerformance(file, minDurationMs, onProgress) {
    var stack = [];
    var slow = [];
    var lineCount = 0;
    var capped = false;
    var SLOW_CAP = 200000; // safety net for pathological files with huge counts of slow calls
    var entryRe = /\[(\d{2}:\d{2}:\d{2}\.\d{3})\].*?-->>\s+\(depth\s+\d+\):\s+(.*?)\((.*?)\)\s+\(in object\s+(.*?)\)/;
    var exitRe = /\[(\d{2}:\d{2}:\d{2}\.\d{3})\].*?<<--\s+\(depth\s+\d+\):\s+(.*)/;
    var tableRe = /"([^"]+)"/;

    for await (var raw of streamLines(file)) {
      lineCount++;
      var line = raw.trim();

      var em = entryRe.exec(line);
      if (em) {
        var timePart = em[1], funcName = em[2], params = em[3], objName = em[4];
        var tableName = 'N/A';
        var tm = tableRe.exec(params);
        if (tm && tm[1].trim()) {
          tableName = tm[1].trim();
        } else if (params.indexOf('whinh') !== -1 || params.indexOf('ttadv') !== -1) {
          var wm = params.match(/[a-z]{5}\d{3}/g);
          if (wm && wm.length) tableName = wm[0];
        }
        var startMs = timeToMs(timePart);
        if (startMs !== null) {
          stack.push({ name: funcName.trim(), table: tableName, start: startMs, object: objName.trim() });
        }
      } else {
        var xm = exitRe.exec(line);
        if (xm && stack.length) {
          var endMs = timeToMs(xm[1]);
          var popInfo = stack.pop();
          if (endMs !== null) {
            var duration = endMs - popInfo.start;
            if (duration < 0) duration += 86400000;
            if (duration > minDurationMs) {
              if (slow.length < SLOW_CAP) {
                slow.push({
                  line: lineCount,
                  functionName: popInfo.name,
                  tableName: popInfo.table,
                  durationMs: Math.round(duration * 100) / 100,
                  executingObject: popInfo.object
                });
              } else {
                capped = true;
              }
            }
          }
        }
      }

      if (onProgress && lineCount % 250000 === 0) onProgress(lineCount);
    }
    if (onProgress) onProgress(lineCount);
    return { slow: slow, lineCount: lineCount, capped: capped };
  }

  // --- Trace Debugger ---
  // Streams the file once. Only the (capped) list of matches is kept in
  // memory — never the full file text.
  async function parseDebugger(file, queries, incDal, incDepth, onProgress) {
    var matches = [];
    var displayMatches = [];
    var capped = false;
    var lineCount = 0;

    var gen = streamLines(file);
    var cur = await gen.next();

    while (!cur.done) {
      lineCount++;
      var line = cur.value;
      var blacklisted = BLACKLIST.some(function (b) { return line.indexOf(b) !== -1; });

      if (!blacklisted) {
        var hasDal = TARGETS.some(function (t) { return line.indexOf(t) !== -1; });
        var hasDepth = line.indexOf('-->>') !== -1 && line.indexOf('(depth') !== -1;
        var matchedQ = queries.find(function (q) { return line.indexOf(q) !== -1; });

        var show = false;
        if (queries.length) {
          if (matchedQ) {
            if (incDal && incDepth) show = hasDal || hasDepth;
            else if (incDal) show = true;
            else if (incDepth) show = hasDepth;
            else show = true;
          }
          if (!show && incDal && hasDal) show = true;
        } else {
          if (incDal && incDepth) show = hasDal && hasDepth;
          else if (incDal) show = hasDal;
          else if (incDepth) show = hasDepth;
        }

        if (show) {
          var clean = line.trim();
          matches.push(clean);

          if (clean.indexOf('form.text$') !== -1) {
            var nxt = await gen.next();
            if (!nxt.done) {
              lineCount++;
              var nextLine = nxt.value.trim();
              displayMatches.push(nextLine.indexOf('3gl call returned:') !== -1 ? nextLine : clean);
              cur = await gen.next();
              if (matches.length >= 50000) { capped = true; break; }
              if (onProgress && lineCount % 250000 === 0) onProgress(lineCount);
              continue;
            } else {
              displayMatches.push(clean);
            }
          } else {
            displayMatches.push(clean);
          }

          if (matches.length >= 50000) { capped = true; break; }
        }
      }

      if (onProgress && lineCount % 250000 === 0) onProgress(lineCount);
      cur = await gen.next();
    }
    if (onProgress) onProgress(lineCount);
    return { matches: matches, displayMatches: displayMatches, capped: capped };
  }

  // Re-streams the original file from disk to rebuild the ancestor chain
  // for a selected line — no need to have kept the whole file in memory.
  async function reconstructStack(file, selectedLine, useTs) {
    if (selectedLine.indexOf('(depth') === -1) return { error: 'no_depth' };

    var sessionMatch = selectedLine.match(/:::\(\d+\):/);
    var sessionId = sessionMatch ? sessionMatch[0] : null;

    var targetDepth = 0;
    try {
      var part = selectedLine.split('(depth')[1];
      targetDepth = parseInt(part.split(')')[0].trim(), 10);
    } catch (e) { targetDepth = 0; }
    if (!(targetDepth > 0)) return { error: 'depth_zero' };

    var stackMap = {};
    for await (var raw of streamLines(file)) {
      var clean = raw.trim();
      if (sessionId && clean.indexOf(sessionId) === -1) continue;

      if (clean.indexOf('-->>') !== -1 && clean.indexOf('(depth') !== -1 && clean.indexOf('(in object') !== -1) {
        if (!BLACKLIST.some(function (b) { return clean.indexOf(b) !== -1; })) {
          try {
            var d = parseInt(clean.split('(depth')[1].split(')')[0].trim(), 10);
            stackMap[d] = clean;
          } catch (e) { /* ignore */ }
        }
      }
      if (clean.indexOf(selectedLine) !== -1) break;
    }

    var validDepths = Object.keys(stackMap).map(Number).filter(function (d) { return d <= targetDepth; }).sort(function (a, b) { return a - b; });
    var output = [];
    for (var j = 0; j < validDepths.length; j++) {
      var t = stackMap[validDepths[j]];
      if (useTs && t.indexOf('-->>') !== -1) t = t.slice(t.indexOf('-->>'));
      output.push(t.trim());
    }
    return { output: output };
  }

  // --- Trace Compare ---
  // Streams the file so it never needs the whole thing as one string.
  // Note: unlike Debug/Performance, this still keeps one lightweight object
  // per non-blank line in memory, because the interactive tree explorer
  // needs to look at neighbouring lines as the user drills down. For
  // typical diagnostic traces (a single flow's worth of logging) this is
  // fine; for a full multi-GB dump, filter/trim it to the relevant section
  // first, or use the Debug/Performance tools instead.
  async function scanTraceLinearly(file, onProgress) {
    var processed = [];
    var depthRe = /\(depth\s+(\d+)\):/;
    var idx = -1;
    for await (var raw of streamLines(file)) {
      idx++;
      if (!raw.trim()) continue;
      var displayText;
      if (raw.indexOf('Flow:') !== -1) {
        var parts = raw.split('Flow:');
        displayText = parts[parts.length - 1];
      } else {
        displayText = ' ' + raw.trim();
      }
      displayText = displayText.trim();
      var dm = depthRe.exec(raw);
      var depth = dm ? parseInt(dm[1], 10) : 0;
      processed.push({
        idx: idx,
        text: displayText,
        raw: raw,
        depth: depth,
        isCall: raw.indexOf('-->') !== -1,
        isReturn: raw.indexOf('<--') !== -1
      });
      if (onProgress && processed.length % 250000 === 0) onProgress(processed.length);
    }
    if (onProgress) onProgress(processed.length);
    return processed;
  }

  function renderExplorer(container, lines, keywords, focusStack, onStackChange) {
    container.innerHTML = '';

    if (!focusStack.length) {
      var any = false;
      lines.forEach(function (row) {
        if (row.isCall) {
          var matchesKw = !keywords.length || keywords.some(function (kw) { return row.raw.toLowerCase().indexOf(kw.toLowerCase()) !== -1; });
          if (matchesKw) {
            any = true;
            var btn = document.createElement('button');
            btn.className = 'ltb-tree-btn';
            btn.textContent = row.text || '(blank call line)';
            btn.title = row.text;
            btn.onclick = function () { focusStack.push(row); onStackChange(); };
            container.appendChild(btn);
          }
        }
      });
      if (!any) {
        var empty = document.createElement('div');
        empty.className = 'ltb-empty';
        empty.textContent = lines.length ? 'No matching call lines found for this filter.' : 'No trace loaded yet.';
        container.appendChild(empty);
      }
      return;
    }

    var backBtn = document.createElement('button');
    backBtn.className = 'ltb-back-btn';
    backBtn.textContent = '← Back';
    backBtn.onclick = function () { focusStack.pop(); onStackChange(); };
    container.appendChild(backBtn);

    var anchor = focusStack[focusStack.length - 1];
    var startIdx = anchor.idx;
    var anchorDepth = anchor.depth;
    var endIdx = lines.length;
    for (var i = startIdx + 1; i < lines.length; i++) {
      if (lines[i].isReturn && lines[i].depth === anchorDepth) { endIdx = i; break; }
    }
    var windowLines = lines.slice(startIdx, Math.min(endIdx + 1, lines.length));

    var card = document.createElement('div');
    card.className = 'ltb-anchor-card';
    card.textContent = '-->> (depth ' + anchorDepth + ')  ' + anchor.text;
    container.appendChild(card);

    var childLabel = document.createElement('div');
    childLabel.className = 'ltb-child-label';
    childLabel.textContent = 'Inner execution layers';
    container.appendChild(childLabel);

    var foundChildren = false;
    var matchesKw = function (row) {
      return !keywords.length || keywords.some(function (kw) { return row.raw.toLowerCase().indexOf(kw.toLowerCase()) !== -1; });
    };
    var shownAtDepth = {}; // tracks whether the currently-open call at a given depth passed the filter
    windowLines.forEach(function (row) {
      if (row.depth === anchorDepth + 1) {
        foundChildren = true;
        if (row.isCall) {
          var show = matchesKw(row);
          shownAtDepth[row.depth] = show;
          if (!show) return; // keyword filter now applies at every depth, not just the root
          var btn = document.createElement('button');
          btn.className = 'ltb-tree-btn';
          btn.textContent = row.text;
          btn.title = row.text;
          btn.onclick = function () { focusStack.push(row); onStackChange(); };
          container.appendChild(btn);
        } else if (row.isReturn) {
          if (shownAtDepth[row.depth] === false) return; // hide the return paired with a filtered-out call
          var ret = document.createElement('div');
          ret.className = 'ltb-return-line';
          ret.textContent = row.text;
          ret.title = row.text;
          container.appendChild(ret);
        }
      }
    });
    if (!foundChildren) {
      var noChild = document.createElement('div');
      noChild.className = 'ltb-empty';
      noChild.textContent = 'No nested calls inside this layer.';
      container.appendChild(noChild);
    }
    if (endIdx < lines.length) {
      var closing = document.createElement('div');
      closing.className = 'ltb-return-line';
      closing.style.borderTop = '1px dashed #38BDF8';
      closing.style.marginTop = '6px';
      closing.textContent = lines[endIdx].text;
      closing.title = lines[endIdx].text;
      container.appendChild(closing);
    }
  }

  /* ============================ UI PRIMITIVES ============================= */

  var messagesEl;

  function scrollToBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

  function addMessage(role, contentEl) {
    var wrap = document.createElement('div');
    wrap.className = 'ltb-msg ltb-msg-' + role;
    var bubble = document.createElement('div');
    bubble.className = 'ltb-bubble';
    bubble.appendChild(contentEl);
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    scrollToBottom();
    return bubble;
  }

  function botText(html) {
    var d = document.createElement('div');
    d.className = 'ltb-text';
    d.innerHTML = html;
    return addMessage('bot', d);
  }

  function userText(text) {
    var d = document.createElement('div');
    d.className = 'ltb-text';
    d.textContent = text;
    return addMessage('user', d);
  }

  // A bot message whose content can be updated in place — used to show
  // "Scanning… N lines so far" progress while a big file streams through.
  function botLiveText(html) {
    var d = document.createElement('div');
    d.className = 'ltb-text';
    d.innerHTML = html;
    addMessage('bot', d);
    return function (newHtml) { d.innerHTML = newHtml; scrollToBottom(); };
  }

  function quickReplies(options) {
    var wrap = document.createElement('div');
    wrap.className = 'ltb-quick-replies';
    var buttons = [];
    options.forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'ltb-chip';
      b.textContent = o.label;
      b.onclick = function () {
        buttons.forEach(function (bb) { bb.disabled = true; });
        userText(o.label);
        o.onClick();
      };
      buttons.push(b);
      wrap.appendChild(b);
    });
    return addMessage('bot', wrap);
  }

  function createDropzone(accept, label, onFile) {
    var wrap = document.createElement('div');
    wrap.className = 'ltb-dropzone';
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ltb-upload-btn';
    btn.textContent = label;
    btn.onclick = function () { input.click(); };
    var status = document.createElement('span');
    status.className = 'ltb-upload-status';
    input.onchange = async function () {
      if (!input.files.length) return;
      var f = input.files[0];
      var sizeMb = (f.size / (1024 * 1024)).toFixed(1);

      if (f.name.toLowerCase().endsWith('.zip')) {
        status.textContent = 'Unzipping ' + f.name + ' (' + sizeMb + ' MB)…';
        try {
          var pseudo = await extractZipAsPseudoFile(f);
          if (!pseudo) { status.textContent = '✗ No .txt/.log file found inside ' + f.name; return; }
          status.textContent = '✓ ' + f.name + ' → ' + pseudo.name + ' (' + (pseudo.size / (1024 * 1024)).toFixed(1) + ' MB) — ready';
          onFile(pseudo);
        } catch (e) {
          status.textContent = '✗ Could not unzip ' + f.name + ': ' + e.message;
        }
        return;
      }

      // .txt/.log/.gz: don't read anything yet — just hand off the File
      // reference. It gets streamed lazily when an action actually runs,
      // so selecting a multi-GB file here is instant.
      status.textContent = '✓ ' + f.name + ' (' + sizeMb + ' MB) — ready';
      onFile(f);
    };
    wrap.appendChild(btn);
    wrap.appendChild(input);
    wrap.appendChild(status);
    return wrap;
  }

  function createCheckbox(label, checked) {
    var wrap = document.createElement('label');
    wrap.className = 'ltb-checkbox';
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    var span = document.createElement('span');
    span.textContent = label;
    wrap.appendChild(input);
    wrap.appendChild(span);
    return { el: wrap, checked: function () { return input.checked; } };
  }

  function labelWrap(labelText, el) {
    var wrap = document.createElement('div');
    var lab = document.createElement('div');
    lab.className = 'ltb-field-label';
    lab.textContent = labelText;
    wrap.appendChild(lab);
    wrap.appendChild(el);
    return wrap;
  }

  function createKeywordInput() {
    var wrap = document.createElement('div');
    var list = document.createElement('div');
    list.className = 'ltb-kw-list';
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Type a keyword and press Enter';
    input.className = 'ltb-kw-input';
    var keywords = [];
    function renderChips() {
      list.innerHTML = '';
      keywords.forEach(function (k, i) {
        var chip = document.createElement('span');
        chip.className = 'ltb-kw-chip';
        chip.textContent = k + ' ✕';
        chip.onclick = function () { keywords.splice(i, 1); renderChips(); };
        list.appendChild(chip);
      });
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var v = input.value.trim();
        if (v && keywords.indexOf(v) === -1) { keywords.push(v); renderChips(); }
        input.value = '';
      }
    });
    wrap.appendChild(list);
    wrap.appendChild(input);
    return { el: wrap, getKeywords: function () { return keywords.slice(); } };
  }

  function createSlider(min, max, val, onChange) {
    var wrap = document.createElement('div');
    wrap.className = 'ltb-slider-wrap';
    var label = document.createElement('div');
    label.className = 'ltb-slider-label';
    label.textContent = 'Threshold: ' + val + ' ms';
    var input = document.createElement('input');
    input.type = 'range';
    input.min = min; input.max = max; input.value = val;
    input.oninput = function () {
      label.textContent = 'Threshold: ' + input.value + ' ms';
      onChange(parseInt(input.value, 10));
    };
    wrap.appendChild(label);
    wrap.appendChild(input);
    return wrap;
  }

  function createButton(text, onClick, variant) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ltb-btn' + (variant ? ' ltb-btn-' + variant : '');
    b.textContent = text;
    b.onclick = onClick;
    return b;
  }

  function createTable(headers, rows, onRowClick) {
    var wrap = document.createElement('div');
    wrap.className = 'ltb-table-wrap';
    var table = document.createElement('table');
    table.className = 'ltb-table';
    var thead = document.createElement('thead');
    var trh = document.createElement('tr');
    headers.forEach(function (h) {
      var th = document.createElement('th');
      th.textContent = h;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    rows.forEach(function (r, i) {
      var tr = document.createElement('tr');
      if (onRowClick) {
        tr.className = 'ltb-row-clickable';
        tr.onclick = function () { onRowClick(i, r); };
      }
      r.forEach(function (cell) {
        var td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  /* =============================== FLOWS ================================== */

  function startDebuggerFlow() {
    botText('Upload your Infor LN trace file (<code>.txt</code>, <code>.log</code>, or <code>.gz</code> — any size, it streams straight off disk). I\'ll scan it for DAL errors, <code>form.text$</code> calls, and depth markers, and let you drill into the call stack behind any hit.');
    var file = null;
    var dz = createDropzone('.txt,.log,.gz', '📎 Upload trace file', function (f) {
      file = f;
      proceedToConfig();
    });
    addMessage('bot', dz);

    function proceedToConfig() {
      botText('Loaded <b>' + file.name + '</b>. Add keywords to search for (optional), pick your filters, then run.');
      var wrap = document.createElement('div');
      wrap.className = 'ltb-config';
      var kw = createKeywordInput();
      var dalCheck = createCheckbox('DAL error filter', true);
      var depthCheck = createCheckbox('Depth marker filter (-->> with depth)', false);
      var tsCheck = createCheckbox('Truncate timestamps in stack view', true);
      wrap.appendChild(labelWrap('Keywords', kw.el));
      wrap.appendChild(dalCheck.el);
      wrap.appendChild(depthCheck.el);
      wrap.appendChild(tsCheck.el);
      var runBtn = createButton('▶ Run search', function () {
        userText('Run search');
        runBtn.disabled = true;
        var setProgress = botLiveText('Scanning…');
        parseDebugger(file, kw.getKeywords(), dalCheck.checked(), depthCheck.checked(), function (n) {
          setProgress('Scanning… ' + n.toLocaleString() + ' lines so far.');
        }).then(function (res) {
          setProgress('✓ Scan complete — ' + res.matches.length.toLocaleString() + ' match(es).');
          runBtn.disabled = false;
          showResults(res, tsCheck.checked());
        }).catch(function (e) {
          setProgress('✗ Error while scanning: ' + e.message);
          runBtn.disabled = false;
        });
      }, 'primary');
      wrap.appendChild(runBtn);
      addMessage('bot', wrap);
    }

    function showResults(res, useTs) {
      if (!res.matches.length) {
        botText('No matching lines found. Try different keywords or filters.');
        return;
      }
      botText('Found <b>' + res.matches.length.toLocaleString() + '</b> matching line(s)' + (res.capped ? ' (capped at 50,000)' : '') + '. Click a row to reconstruct its call stack.');
      var shown = Math.min(500, res.displayMatches.length);
      var rows = res.displayMatches.slice(0, shown).map(function (l) { return [l]; });
      var table = createTable(['Filtered trace output'], rows, function (i) {
        var selected = res.matches[i];
        userText('View stack → line ' + (i + 1));
        var setProgress = botLiveText('Reconstructing call stack…');
        reconstructStack(file, selected, useTs).then(function (result) {
          if (result.error === 'no_depth') {
            setProgress('This line has no structured depth marker <code>(depth X)</code>, so a call stack can\'t be reconstructed.');
          } else if (result.error === 'depth_zero') {
            setProgress('This is a top-level call (depth 0) — there\'s no parent stack above it.');
          } else if (!result.output.length) {
            setProgress('No matching trace-tree elements found leading up to this line.');
          } else {
            setProgress('Reconstructed call path:');
            var pre = document.createElement('pre');
            pre.className = 'ltb-pre';
            pre.textContent = result.output.join('\n\n');
            addMessage('bot', pre);
          }
        }).catch(function (e) {
          setProgress('✗ Error while reconstructing: ' + e.message);
        });
      });
      addMessage('bot', table);
      if (res.displayMatches.length > shown) {
        botText('Showing the first ' + shown + ' of ' + res.displayMatches.length.toLocaleString() + ' rows for performance.');
      }
    }
  }

  function startPerformanceFlow() {
    botText('Upload your trace file. I\'ll pair up <code>-->></code> / <code>&lt;&lt;--</code> lines by timestamp and flag anything slower than your threshold. Any file size works — it streams straight off disk.');
    var file = null;
    var dz = createDropzone('.txt,.log,.gz', '📎 Upload trace file', function (f) {
      file = f;
      proceedToThreshold();
    });
    addMessage('bot', dz);

    function proceedToThreshold() {
      botText('Loaded <b>' + file.name + '</b>. Set the slow-call threshold, then run the scan.');
      var wrap = document.createElement('div');
      wrap.className = 'ltb-config';
      var threshold = 10;
      wrap.appendChild(createSlider(0, 500, 10, function (v) { threshold = v; }));
      var runBtn = createButton('▶ Analyze', function () {
        userText('Analyze (threshold ' + threshold + 'ms)');
        runBtn.disabled = true;
        var setProgress = botLiveText('Scanning…');
        parsePerformance(file, threshold, function (n) {
          setProgress('Scanning… ' + n.toLocaleString() + ' lines so far.');
        }).then(function (res) {
          setProgress('✓ Scan complete — ' + res.lineCount.toLocaleString() + ' lines.');
          runBtn.disabled = false;
          showPerfResults(res, threshold);
        }).catch(function (e) {
          setProgress('✗ Error while scanning: ' + e.message);
          runBtn.disabled = false;
        });
      }, 'primary');
      wrap.appendChild(runBtn);
      addMessage('bot', wrap);
    }

    function showPerfResults(res, threshold) {
      if (res.lineCount === 0) {
        botText('No lines could be parsed — check the file format.');
        return;
      }
      botText('Scanned <b>' + res.lineCount.toLocaleString() + '</b> lines. Found <b>' + res.slow.length.toLocaleString() + '</b> call(s) slower than ' + threshold + 'ms' + (res.capped ? ' (capped at 200,000 — narrow your threshold for a fuller picture)' : '') + '.');
      if (!res.slow.length) {
        botText('No slow operations detected past your filter. 🎉');
        return;
      }
      var sorted = res.slow.slice().sort(function (a, b) { return b.durationMs - a.durationMs; });
      var shown = Math.min(500, sorted.length);
      var rows = sorted.slice(0, shown).map(function (s) {
        return [s.functionName, s.tableName, s.durationMs.toFixed(2), s.executingObject];
      });
      addMessage('bot', createTable(['Function', 'Table', 'Duration (ms)', 'Object'], rows));
      if (sorted.length > shown) botText('Showing the ' + shown + ' slowest of ' + sorted.length.toLocaleString() + ' calls.');

      var agg = {};
      res.slow.forEach(function (s) {
        var key = s.functionName + '|||' + s.tableName;
        if (!agg[key]) agg[key] = { functionName: s.functionName, tableName: s.tableName, executions: 0, total: 0 };
        agg[key].executions++;
        agg[key].total += s.durationMs;
      });
      var aggRows = Object.keys(agg).map(function (k) { return agg[k]; })
        .sort(function (a, b) { return b.total - a.total; })
        .slice(0, 500)
        .map(function (a) { return [a.functionName, a.tableName, a.executions, a.total.toFixed(2)]; });
      botText('Aggregated bottleneck matrix (grouped by function + table):');
      addMessage('bot', createTable(['Function', 'Table', 'Executions', 'Total duration (ms)'], aggRows));
    }
  }

  function startCompareFlow() {
    botText('Upload a <b>working</b> trace and a <b>broken</b> trace (<code>.txt</code>, <code>.log</code>, <code>.gz</code>, <code>.zip</code>). Click through each call tree side-by-side to spot where they diverge.');
    botText('Note: unlike Debug/Performance, this tool keeps one lightweight entry per line in memory so you can interactively drill through it — great for a normal diagnostic trace, but for a multi-GB dump, trim it to the relevant session first or use the other two tools instead.');

    var grid = document.createElement('div');
    grid.className = 'ltb-compare-grid';
    var colA = document.createElement('div'); colA.className = 'ltb-compare-col';
    var colB = document.createElement('div'); colB.className = 'ltb-compare-col';
    var titleA = document.createElement('div'); titleA.className = 'ltb-compare-title ltb-compare-title-ok'; titleA.textContent = '✅ Working trace';
    var titleB = document.createElement('div'); titleB.className = 'ltb-compare-title ltb-compare-title-bad'; titleB.textContent = '❌ Broken trace';
    colA.appendChild(titleA); colB.appendChild(titleB);

    var fileA = null, fileB = null;
    colA.appendChild(createDropzone('.txt,.log,.gz,.zip', '📎 Upload working trace', function (f) { fileA = f; }));
    colB.appendChild(createDropzone('.txt,.log,.gz,.zip', '📎 Upload broken trace', function (f) { fileB = f; }));
    grid.appendChild(colA); grid.appendChild(colB);
    addMessage('bot', grid);

    var kwWrap = document.createElement('div');
    kwWrap.className = 'ltb-config';
    var kw = createKeywordInput();
    kwWrap.appendChild(labelWrap('Filter keywords (optional — narrows the root-level call list)', kw.el));
    var buildBtn = createButton('🔍 Build explorers', function () {
      userText('Build explorers');
      if (!fileA && !fileB) {
        botText('Upload at least one trace file first.');
        return;
      }
      buildBtn.disabled = true;
      var setProgressA = fileA ? botLiveText('Indexing working trace…') : null;
      var setProgressB = fileB ? botLiveText('Indexing broken trace…') : null;

      Promise.all([
        fileA ? scanTraceLinearly(fileA, function (n) { setProgressA('Indexing working trace… ' + n.toLocaleString() + ' lines.'); }) : Promise.resolve(null),
        fileB ? scanTraceLinearly(fileB, function (n) { setProgressB('Indexing broken trace… ' + n.toLocaleString() + ' lines.'); }) : Promise.resolve(null)
      ]).then(function (results) {
        if (setProgressA) setProgressA('✓ Working trace indexed (' + (results[0] ? results[0].length.toLocaleString() : 0) + ' lines).');
        if (setProgressB) setProgressB('✓ Broken trace indexed (' + (results[1] ? results[1].length.toLocaleString() : 0) + ' lines).');
        buildBtn.disabled = false;
        renderBoth(results[0], results[1]);
      }).catch(function (e) {
        if (setProgressA) setProgressA('✗ Error: ' + e.message);
        if (setProgressB) setProgressB('✗ Error: ' + e.message);
        buildBtn.disabled = false;
      });
    }, 'primary');
    kwWrap.appendChild(buildBtn);
    addMessage('bot', kwWrap);

    function renderBoth(dataA, dataB) {
      var explorerGrid = document.createElement('div');
      explorerGrid.className = 'ltb-compare-grid';
      var explA = document.createElement('div'); explA.className = 'ltb-explorer';
      var explB = document.createElement('div'); explB.className = 'ltb-explorer';
      explorerGrid.appendChild(explA); explorerGrid.appendChild(explB);

      var keywords = kw.getKeywords();
      var focusA = [], focusB = [];
      function renderA() { renderExplorer(explA, dataA || [], keywords, focusA, renderA); }
      function renderB() { renderExplorer(explB, dataB || [], keywords, focusB, renderB); }
      if (dataA) renderA(); else explA.innerHTML = '<div class="ltb-empty">No working trace uploaded.</div>';
      if (dataB) renderB(); else explB.innerHTML = '<div class="ltb-empty">No broken trace uploaded.</div>';

      addMessage('bot', explorerGrid);
    }
  }

  /* ============================= CONVERSATION ============================= */

  function showMainMenu() {
    botText('Hi! I\'m <b>' + CONFIG.title + '</b>. I can help you debug, compare, and profile Infor LN trace logs — right here in chat. Everything runs locally in your browser; your trace files are never uploaded anywhere. What would you like to do?');
    quickReplies([
      { label: '🐞 Debug a trace', onClick: startDebuggerFlow },
      { label: '🔀 Compare two traces', onClick: startCompareFlow },
      { label: '⚡ Check performance', onClick: startPerformanceFlow },
      { label: '❓ How this works', onClick: showHelp }
    ]);
  }

  function showHelp() {
    botText(
      'All parsing happens locally in your browser.<br><br>' +
      '<b>Debug</b> — search for DAL errors / custom keywords and reconstruct the call stack behind any matched line.<br>' +
      '<b>Compare</b> — click through two traces side-by-side to see where a broken flow diverges from a working one.<br>' +
      '<b>Performance</b> — pairs up entry/exit lines by timestamp to surface the slowest calls.'
    );
    quickReplies([{ label: '⬅ Back to menu', onClick: showMainMenu }]);
  }

  /* =============================== BOOTSTRAP =============================== */

  function buildPanel() {
    var root = document.createElement('div');
    root.id = 'ltb-root';
    root.innerHTML =
      '<button id="ltb-launcher" aria-label="Open ' + CONFIG.title + '">' +
        '<span class="ltb-launcher-prompt">ln&gt;</span><span class="ltb-cursor"></span>' +
      '</button>' +
      '<div id="ltb-panel" class="ltb-hidden">' +
        '<div id="ltb-titlebar">' +
          '<span class="ltb-dot ltb-dot-red"></span>' +
          '<span class="ltb-dot ltb-dot-amber"></span>' +
          '<span class="ltb-dot ltb-dot-green"></span>' +
          '<span class="ltb-title">' + CONFIG.title + '</span>' +
          '<button id="ltb-restart" title="Start over">↺</button>' +
          '<button id="ltb-close" title="Close">✕</button>' +
        '</div>' +
        '<div id="ltb-messages"></div>' +
      '</div>';
    document.body.appendChild(root);

    var launcher = root.querySelector('#ltb-launcher');
    var panel = root.querySelector('#ltb-panel');
    messagesEl = root.querySelector('#ltb-messages');

    launcher.onclick = function () { panel.classList.toggle('ltb-hidden'); };
    root.querySelector('#ltb-close').onclick = function () { panel.classList.add('ltb-hidden'); };
    root.querySelector('#ltb-restart').onclick = function () { messagesEl.innerHTML = ''; showMainMenu(); };

    showMainMenu();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildPanel);
  } else {
    buildPanel();
  }
})();
