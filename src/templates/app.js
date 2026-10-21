/* app.js - What the app does: tabs, search, jump links and "copy LaTeX".
   The formulas themselves come from window.FORMULA_DATA, which builder.py
   writes from your .tex files. */
(function () {
  "use strict";

  var DATA = window.FORMULA_DATA || { sheets: [] };
  var $ = function (id) { return document.getElementById(id); };
  var list = $("list"), q = $("q"), tabsEl = $("tabs"), jumpEl = $("jump");
  var countEl = $("count"), emptyEl = $("empty"), footEl = $("foot");

  // Lowercase and remove accents, so "Archimedes" and "archimédes" match.
  function norm(s) {
    return (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // ---------- 1. Build every section header and card once ----------
  // entries holds one object per header/card, in the order of your LaTeX files.
  var entries = [];
  var totalCards = 0;

  DATA.sheets.forEach(function (sheet) {
    sheet.sections.forEach(function (section) {
      var head = el("div", "sec");
      head.id = section.id;
      head.style.setProperty("--sec", section.color);
      head.appendChild(el("p", "sec-sheet", sheet.name));
      var h2 = el("h2", null, section.title_html);
      h2.insertBefore(el("span", "dot"), h2.firstChild);
      head.appendChild(h2);
      if (section.intro_html) head.appendChild(el("div", "sec-intro", section.intro_html));
      list.appendChild(head);
      entries.push({ kind: "section", el: head, sheet: sheet, section: section, order: entries.length });

      section.cards.forEach(function (card) {
        var art = el("article", "card");
        art.id = card.id;
        art.style.setProperty("--sec", section.color);

        var top = el("div", "card-head");
        top.appendChild(el("h3", null, card.title_html));
        var copy = el("button", "copy", "TeX");
        copy.type = "button";
        copy.title = "Copy the LaTeX source of this card";
        copy.setAttribute("aria-label", "Copy LaTeX of " + card.title_text);
        copy.addEventListener("click", function () { copyText(card.latex, copy); });
        top.appendChild(copy);
        art.appendChild(top);

        var crumb = el("p", "crumb");
        crumb.appendChild(el("span", "dot"));
        crumb.appendChild(document.createTextNode(sheet.name + " · " + section.title_text));
        art.appendChild(crumb);
        art.appendChild(el("div", "card-body", card.body_html));
        list.appendChild(art);

        totalCards++;
        entries.push({
          kind: "card", el: art, sheet: sheet, section: section, order: entries.length,
          // what the search looks at, from most to least important:
          t: norm(card.title_text),
          s: norm(section.title_text + " " + sheet.name),
          b: norm(card.body_text),
        });
      });
    });
  });

  // ---------- 2. Search ----------
  // Every word you type must appear somewhere in the card. Words found in
  // the title count most, then the section name, then the formula/explanation.
  function score(e, words, phrase) {
    var s = 0;
    if (e.t.indexOf(phrase) !== -1) s += 20;
    if (e.t.indexOf(phrase) === 0) s += 10;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (e.t.indexOf(w) !== -1) s += 6;
      else if (e.s.indexOf(w) !== -1) s += 3;
      else if (e.b.indexOf(w) !== -1) s += 1;
      else return 0;
    }
    return s;
  }

  // ---------- 3. Tabs (All / one per sheet) ----------
  var tabs = [{ id: "all", name: "All" }].concat(DATA.sheets.map(function (s) {
    return { id: s.id, name: s.name };
  }));
  var current = "all";
  var fromHash = (location.hash || "").slice(1);
  var saved = null;
  try { saved = localStorage.getItem("formula-tab"); } catch (err) { /* storage blocked */ }
  [fromHash, saved].some(function (id) {
    if (tabs.some(function (t) { return t.id === id; })) { current = id; return true; }
    return false;
  });

  tabs.forEach(function (t) {
    var n = t.id === "all" ? totalCards : DATA.sheets.filter(function (s) { return s.id === t.id; })[0]
      .sections.reduce(function (sum, sec) { return sum + sec.cards.length; }, 0);
    var b = el("button", "tab", t.name + '<span class="n">' + n + "</span>");
    b.type = "button";
    b.id = "tab-" + t.id;
    b.setAttribute("role", "tab");
    b.addEventListener("click", function () { selectTab(t.id); });
    tabsEl.appendChild(b);
  });

  function selectTab(id) {
    current = id;
    try { localStorage.setItem("formula-tab", id); } catch (err) { /* ignore */ }
    try { history.replaceState(null, "", "#" + id); } catch (err) { /* ignore */ }
    apply();
    window.scrollTo(0, 0);
  }

  // ---------- 4. Show / hide everything for the current tab + search ----------
  function apply() {
    var phrase = norm(q.value.trim());
    var words = phrase.split(/\s+/).filter(Boolean);
    var searching = words.length > 0;
    var shown = 0, elsewhere = 0, ranked = [];
    list.classList.toggle("searching", searching);

    entries.forEach(function (e) {
      var inTab = current === "all" || e.sheet.id === current;
      e.el.style.order = e.order;
      if (e.kind === "section") { e.el.hidden = searching || !inTab; return; }
      if (!searching) { e.el.hidden = !inTab; if (inTab) shown++; return; }
      var s = score(e, words, phrase);
      e.el.hidden = !(s && inTab);
      if (s && inTab) ranked.push([s, e]);
      else if (s) elsewhere++;
    });

    if (searching) {
      ranked.sort(function (a, b) { return b[0] - a[0] || a[1].order - b[1].order; });
      ranked.forEach(function (r, i) { r[1].el.style.order = i; });
      shown = ranked.length;
    }

    tabs.forEach(function (t) {
      $("tab-" + t.id).setAttribute("aria-selected", String(t.id === current));
    });
    countEl.textContent = searching
      ? shown + (shown === 1 ? " match" : " matches")
      : shown + " formulas";
    renderJump(searching);
    renderEmpty(shown, elsewhere, q.value.trim());
  }

  function renderJump(searching) {
    jumpEl.hidden = searching;
    if (searching) return;
    jumpEl.innerHTML = "";
    entries.forEach(function (e) {
      if (e.kind !== "section" || e.el.hidden) return;
      var b = el("button");
      b.type = "button";
      b.appendChild(el("span", "dot"));
      b.style.setProperty("--sec", e.section.color);
      b.appendChild(document.createTextNode(e.section.title_text));
      b.addEventListener("click", function () { e.el.scrollIntoView(); });
      jumpEl.appendChild(b);
    });
  }

  function renderEmpty(shown, elsewhere, query) {
    emptyEl.hidden = shown > 0;
    if (shown > 0) return;
    emptyEl.innerHTML = "";
    var p = el("p");
    p.appendChild(document.createTextNode("No formula in this tab matches "));
    p.appendChild(el("strong")).textContent = "“" + query + "”";
    p.appendChild(document.createTextNode(". Try fewer or shorter words."));
    emptyEl.appendChild(p);
    if (elsewhere) {
      var b = el("button", null, "Show " + elsewhere + (elsewhere === 1 ? " match" : " matches") + " in all sheets");
      b.type = "button";
      b.addEventListener("click", function () { selectTab("all"); });
      emptyEl.appendChild(b);
    }
  }

  // ---------- 5. Copy LaTeX ----------
  function copyText(text, button) {
    function done(label) {
      button.textContent = label;
      setTimeout(function () { button.textContent = "TeX"; }, 1400);
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
      document.body.removeChild(ta);
      done(ok ? "Copied" : "Failed");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done("Copied"); }, fallback);
    } else {
      fallback();
    }
  }

  // ---------- 6. Keyboard: "/" to search, Esc to clear ----------
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "/" && document.activeElement !== q) {
      ev.preventDefault();
      q.focus();
    } else if (ev.key === "Escape" && document.activeElement === q) {
      q.value = "";
      apply();
      q.blur();
    }
  });
  q.addEventListener("input", function () { apply(); window.scrollTo(0, 0); });

  // A link ending in #statics (or #calculus, #all) opens that tab.
  window.addEventListener("hashchange", function () {
    var id = location.hash.slice(1);
    if (tabs.some(function (t) { return t.id === id; }) && id !== current) selectTab(id);
  });

  // Keep the sticky header from covering a section you jump to.
  var topbar = $("topbar");
  function measure() {
    document.documentElement.style.setProperty("--head-h", topbar.offsetHeight + "px");
  }
  if (window.ResizeObserver) new ResizeObserver(measure).observe(topbar);
  measure();

  // ---------- 7. Offline app (service worker, see sw.js) ----------
  // Only in the installable version (web/index.html), which has a manifest.
  // sw.js keeps a copy of the app on your device so it opens without internet.
  // When you publish new formulas, the next time the app is opened online it
  // finds the new version and offers to reload.
  if ("serviceWorker" in navigator && document.querySelector('link[rel="manifest"]')) {
    // Show the "New formulas are available" bar if the saved copy of the app
    // differs from what is on screen (builder.py gives each build a "version").
    var checkForNewVersion = function () {
      if (!navigator.serviceWorker.controller) return;   // not installed yet
      fetch("index.html").then(function (r) { return r.text(); }).then(function (html) {
        if (html.indexOf('"version": "' + DATA.version + '"') === -1) $("update").hidden = false;
      }).catch(function () { /* offline: try again next time */ });
    };
    navigator.serviceWorker.register("sw.js").then(function (reg) {
      checkForNewVersion();
      // Phones keep apps open in the background: check again when you return.
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") reg.update().then(checkForNewVersion, function () {});
      });
    }).catch(function () { /* e.g. opened as a file: works, just not offline */ });
    navigator.serviceWorker.addEventListener("controllerchange", checkForNewVersion);
    $("reload").addEventListener("click", function () { location.reload(); });
  }

  footEl.innerHTML = "Built " + DATA.built + " from <code>" + DATA.sources.join("</code>, <code>") +
    "</code>. Edit the LaTeX and run <code>src/main.py</code> to update.";
  apply();
})();
