(function () {
  "use strict";

  var STORE_PREFIX = "l9-";

  // ---------------------------------------------------------------- storage
  function saveStore(key, value) {
    try { localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }
  function loadStore(key) {
    try {
      var v = localStorage.getItem(STORE_PREFIX + key);
      return v === null ? null : JSON.parse(v);
    } catch (e) { return null; }
  }
  function clearAllStore() {
    try {
      var toRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(STORE_PREFIX) === 0) toRemove.push(k);
      }
      toRemove.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------- text/number inputs
  function wireTextInputs() {
    document.querySelectorAll("[data-store]").forEach(function (el) {
      if (el.type === "checkbox") return; // handled separately
      var key = el.getAttribute("data-store");
      var saved = loadStore(key);
      if (saved !== null) el.value = saved;
      el.addEventListener("input", function () { saveStore(key, el.value); });
    });
    document.querySelectorAll('input[type="checkbox"][data-store]').forEach(function (el) {
      var key = el.getAttribute("data-store");
      var saved = loadStore(key);
      if (saved !== null) el.checked = !!saved;
      el.addEventListener("change", function () { saveStore(key, el.checked); });
    });
  }

  // ------------------------------------------------------------ reveal buttons
  function wireRevealButtons() {
    document.querySelectorAll("[data-reveal]").forEach(function (btn) {
      var targetId = btn.getAttribute("data-reveal");
      var stateKey = "revealed-" + targetId;
      var target = document.getElementById(targetId);
      if (!target) return;
      if (loadStore(stateKey)) { target.hidden = false; btn.textContent = "Model answer shown below"; btn.disabled = true; }
      btn.addEventListener("click", function () {
        target.hidden = false;
        btn.textContent = "Model answer shown below";
        btn.disabled = true;
        saveStore(stateKey, true);
      });
    });
  }

  // --------------------------------------------------------- numeric checker
  function wireNumericCheckers() {
    document.querySelectorAll("[data-check-num]").forEach(function (btn) {
      var inputId = btn.getAttribute("data-check-num");
      var answer = parseFloat(btn.getAttribute("data-answer"));
      var input = document.getElementById(inputId);
      var feedback = document.getElementById(inputId + "-feedback");
      btn.addEventListener("click", function () {
        var val = parseFloat(input.value);
        feedback.hidden = false;
        if (val === answer) {
          feedback.textContent = "Correct — " + answer + " ms.";
          feedback.className = "feedback correct";
        } else {
          feedback.textContent = "Not quite. Think: 1000 ms ÷ 50 passes per second.";
          feedback.className = "feedback incorrect";
        }
      });
    });
  }

  // ------------------------------------------------------------- single-select
  function shuffleChildren(container, selector) {
    var items = Array.prototype.slice.call(container.querySelectorAll(selector));
    for (var i = items.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = items[i]; items[i] = items[j]; items[j] = tmp;
    }
    items.forEach(function (el) { container.appendChild(el); }); // appendChild on an existing node moves it
  }

  function wireSingleSelects() {
    document.querySelectorAll(".single-select").forEach(function (block) {
      // Randomise option order on every load — otherwise the correct answer
      // sitting in the same position every time turns a check into a
      // position-memorisation exercise instead of a real check.
      shuffleChildren(block, "button");
      var id = block.id;
      var correct = block.getAttribute("data-correct");
      var feedback = id ? document.getElementById(id + "-feedback") : null;
      var stateKey = "single-" + (id || Math.random());

      function applyAnswer(value) {
        block.classList.add("answered");
        block.querySelectorAll("button").forEach(function (b) {
          b.disabled = true;
          if (b.getAttribute("data-value") === correct) b.classList.add("correct");
          else if (b.getAttribute("data-value") === value) b.classList.add("incorrect");
        });
        if (feedback) {
          feedback.hidden = false;
          if (value === correct) {
            feedback.textContent = "Correct.";
            feedback.className = "feedback correct";
          } else {
            feedback.textContent = "Not quite — the highlighted option is correct.";
            feedback.className = "feedback incorrect";
          }
        }
      }

      var saved = loadStore(stateKey);
      if (saved) applyAnswer(saved);

      block.querySelectorAll("button").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (block.classList.contains("answered")) return;
          var value = btn.getAttribute("data-value");
          saveStore(stateKey, value);
          applyAnswer(value);
        });
      });
    });
  }

  // ------------------------------------------------------------ classify grid
  var CLASSIFY_ITEMS = [
    { id: "c1", snippet: 'Serial.println("Arm booting...");', isControl: false,
      explain: "A start-up message doesn't decide what the system does next — it's not part of the control algorithm." },
    { id: "c2", snippet: 'logFile.write(millis(), sensorValue);', isControl: false,
      explain: "Logging records what happened — it doesn't compute an output for the actuators." },
    { id: "c3", snippet: 'angle = map(reading, 0, 1023, 0, 180); servo.write(angle);', isControl: true,
      explain: "This reads a sensor value and computes an output sent to an actuator — exactly the control algorithm's job." },
    { id: "c4", snippet: 'menu.print("1: Teleop  2: Auto");', isControl: false,
      explain: "A UI menu print is part of the interface, not the part deciding actuator outputs." }
  ];

  function buildClassifyGrid() {
    var grid = document.getElementById("classify-1");
    if (!grid) return;
    CLASSIFY_ITEMS.forEach(function (item) {
      var div = document.createElement("div");
      div.className = "classify-item";
      div.innerHTML =
        '<div class="snippet">' + item.snippet.replace(/</g, "&lt;") + '</div>' +
        '<div class="btn-row">' +
        '<button data-value="control" type="button">Control algorithm</button>' +
        '<button data-value="not" type="button">Not</button>' +
        '</div>' +
        '<div class="explain">' + item.explain + '</div>';
      grid.appendChild(div);

      var stateKey = "classify-" + item.id;
      function applyAnswer(value) {
        div.classList.add("answered");
        div.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
        var correctValue = item.isControl ? "control" : "not";
        div.querySelectorAll("button").forEach(function (b) {
          if (b.getAttribute("data-value") === correctValue) b.classList.add("correct");
          else if (b.getAttribute("data-value") === value) b.classList.add("incorrect");
        });
      }
      var saved = loadStore(stateKey);
      if (saved) applyAnswer(saved);
      div.querySelectorAll("button").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (div.classList.contains("answered")) return;
          var value = btn.getAttribute("data-value");
          saveStore(stateKey, value);
          applyAnswer(value);
        });
      });
    });
  }

  // ------------------------------------------------------------------ hotspots
  function wireHotspots() {
    document.querySelectorAll("[data-reveal-hotspot]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var note = document.getElementById(btn.getAttribute("data-reveal-hotspot"));
        if (note) note.hidden = !note.hidden;
      });
    });
  }

  // -------------------------------------------------- setpoint match exercise
  function buildSetpointMatch() {
    var wrap = document.getElementById("match-setpoint");
    if (!wrap) return;
    var pairs = JSON.parse(wrap.getAttribute("data-pairs"));
    var chipRow = document.getElementById("match-setpoint-chips");
    var targetRow = document.getElementById("match-setpoint-targets");
    var feedback = document.getElementById("match-setpoint-feedback");
    var selectedNote = document.getElementById("match-setpoint-selected-note");
    var checkBtn = document.getElementById("match-setpoint-check-btn");
    var selected = null;                                        // click-to-place
    var placements = loadStore("match-setpoint-placements") || {}; // target id -> label, free until checked

    function setSelected(label) {
      selected = label;
      if (selectedNote) selectedNote.textContent = label ? ('Selected: "' + label + '" — now click (or drag) it onto a box.') : "";
    }
    function targetForChip(label) {
      return pairs.filter(function (p) { return placements[p.target] === label; }).map(function (p) { return p.target; })[0] || null;
    }
    function chipEl(label) {
      return chipRow.querySelector('[data-label="' + label.replace(/"/g, '\\"') + '"]');
    }
    function renderTarget(pair, btn) {
      btn.classList.remove("checked-correct", "checked-wrong");
      var labelSpan = btn.querySelector(".target-label");
      if (placements[pair.target]) {
        btn.classList.add("occupied");
        labelSpan.textContent = placements[pair.target];
      } else {
        btn.classList.remove("occupied");
        labelSpan.textContent = "Drop here";
      }
    }
    function place(label, targetId) {
      var prevTargetId = targetForChip(label);
      if (prevTargetId && prevTargetId !== targetId) delete placements[prevTargetId];
      placements[targetId] = label;
      saveStore("match-setpoint-placements", placements);
      pairs.forEach(function (p) { renderTarget(p, document.getElementById(p.target)); });
      feedback.hidden = true;
      setSelected(null);
      chipRow.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("selected"); });
    }

    // shuffle a copy for chip order so it isn't the same order as targets
    var shuffled = pairs.slice().sort(function () { return Math.random() - 0.5; });

    shuffled.forEach(function (pair) {
      var chip = document.createElement("button");
      chip.className = "chip";
      chip.type = "button";
      chip.draggable = true;
      chip.textContent = pair.label;
      chip.setAttribute("data-label", pair.label);
      chip.addEventListener("click", function () {
        chipRow.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("selected"); });
        chip.classList.add("selected");
        setSelected(pair.label);
        feedback.hidden = true;
      });
      chip.addEventListener("dragstart", function (e) {
        e.dataTransfer.setData("text/plain", pair.label);
        e.dataTransfer.effectAllowed = "move";
        chip.classList.add("dragging");
      });
      chip.addEventListener("dragend", function () { chip.classList.remove("dragging"); });
      chipRow.appendChild(chip);
    });

    pairs.forEach(function (pair) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.id = pair.target;
      btn.innerHTML = '<span class="target-label">Drop here</span><span class="target-text">' + pair.text + "</span>";
      btn.addEventListener("click", function () {
        if (!selected) {
          feedback.hidden = false;
          feedback.className = "feedback incorrect";
          feedback.textContent = "Click a chip first, then click a box — or just drag a chip straight onto a box.";
          return;
        }
        place(selected, pair.target);
      });
      btn.addEventListener("dragover", function (e) { e.preventDefault(); btn.classList.add("drag-over"); });
      btn.addEventListener("dragleave", function () { btn.classList.remove("drag-over"); });
      btn.addEventListener("drop", function (e) {
        e.preventDefault();
        btn.classList.remove("drag-over");
        var label = e.dataTransfer.getData("text/plain");
        if (label) place(label, pair.target);
      });
      targetRow.appendChild(btn);
      renderTarget(pair, btn);
    });

    checkBtn.addEventListener("click", function () {
      var filledCount = 0, correctCount = 0;
      pairs.forEach(function (pair) {
        var btn = document.getElementById(pair.target);
        btn.classList.remove("checked-correct", "checked-wrong");
        var placedLabel = placements[pair.target];
        if (!placedLabel) return;
        filledCount++;
        var isRight = placedLabel === pair.label;
        btn.classList.add(isRight ? "checked-correct" : "checked-wrong");
        if (isRight) correctCount++;
      });
      feedback.hidden = false;
      if (filledCount < pairs.length) {
        feedback.className = "feedback incorrect";
        feedback.textContent = "Fill in all three boxes before checking — " + (pairs.length - filledCount) + " still empty.";
      } else if (correctCount === pairs.length) {
        feedback.className = "feedback correct";
        feedback.textContent = "All matched correctly.";
      } else {
        feedback.className = "feedback incorrect";
        feedback.textContent = correctCount + " of " + pairs.length + " correct — fix the red box(es) and check again.";
      }
    });
  }

  // ------------------------------------------------------------- cost match
  function buildCostMatch() {
    var chipRow = document.getElementById("cost-chips");
    var target = document.getElementById("cost-read-target");
    var feedback = document.getElementById("cost-feedback");
    if (!chipRow || !target) return;
    var placed = loadStore("cost-match") || [];
    var selected = null;

    function markChipsPlaced() {
      chipRow.querySelectorAll(".chip").forEach(function (c) {
        if (placed.indexOf(c.getAttribute("data-label")) !== -1) c.classList.add("placed");
      });
    }
    markChipsPlaced();
    if (placed.length === 3) {
      target.classList.add("filled");
      feedback.hidden = false;
      feedback.className = "feedback correct";
      feedback.textContent = "Correct — money, space, and time all land on Read.";
    }

    function tryPlace(label) {
      if (!label || placed.indexOf(label) !== -1) return;
      placed.push(label);
      saveStore("cost-match", placed);
      markChipsPlaced();
      selected = null;
      if (placed.length === 3) {
        target.classList.add("filled");
        feedback.hidden = false;
        feedback.className = "feedback correct";
        feedback.textContent = "Correct — money, space, and time all land on Read.";
      }
    }

    chipRow.querySelectorAll(".chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        if (chip.classList.contains("placed")) return;
        chipRow.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("selected"); });
        chip.classList.add("selected");
        selected = chip.getAttribute("data-label");
      });
      chip.addEventListener("dragstart", function (e) {
        if (chip.classList.contains("placed")) { e.preventDefault(); return; }
        e.dataTransfer.setData("text/plain", chip.getAttribute("data-label"));
        e.dataTransfer.effectAllowed = "move";
        chip.classList.add("dragging");
      });
      chip.addEventListener("dragend", function () { chip.classList.remove("dragging"); });
    });

    target.addEventListener("click", function () { tryPlace(selected); });
    target.addEventListener("dragover", function (e) { e.preventDefault(); target.classList.add("drag-over"); });
    target.addEventListener("dragleave", function () { target.classList.remove("drag-over"); });
    target.addEventListener("drop", function (e) {
      e.preventDefault();
      target.classList.remove("drag-over");
      tryPlace(e.dataTransfer.getData("text/plain"));
    });
  }

  // -------------------------------------------------------- structure chart
  function buildStructureChart() {
    var wrap = document.querySelector(".sc-exercise");
    if (!wrap) return;
    var image = document.getElementById("sc-image");
    var chipRow = document.getElementById("sc-chips");
    var chips = Array.prototype.slice.call(chipRow.querySelectorAll(".chip"));
    var checkBtn = document.getElementById("sc-check-btn");
    var feedback = document.getElementById("sc-feedback");
    var followup = document.getElementById("sc-followup");
    var selectedNote = document.getElementById("sc-selected-note");
    var targets = Array.prototype.slice.call(wrap.querySelectorAll(".sc-target"));
    var selected = null;            // click-to-place: the currently-selected chip label
    var placements = loadStore("sc-placements") || {};   // targetId -> chip label, freely editable until checked

    function setSelected(label) {
      selected = label;
      if (!selectedNote) return;
      selectedNote.textContent = label ? ('Selected: "' + label + '" — now click (or drag) it onto the box it belongs in.') : "";
    }

    function targetForChip(label) {
      return targets.filter(function (t) { return placements[t.id] === label; })[0] || null;
    }

    function renderTarget(t) {
      t.classList.remove("checked-correct", "checked-wrong");
      if (placements[t.id]) {
        t.classList.add("occupied");
        t.textContent = placements[t.id];
      } else {
        t.classList.remove("occupied");
        t.textContent = "";
      }
    }

    function place(label, targetId) {
      // a chip already sitting in a different box moves rather than duplicates
      var prevTarget = targetForChip(label);
      if (prevTarget && prevTarget.id !== targetId) delete placements[prevTarget.id];
      placements[targetId] = label;
      saveStore("sc-placements", placements);
      targets.forEach(renderTarget);
      feedback.hidden = true;
      setSelected(null);
      chips.forEach(function (c) { c.classList.remove("selected"); });
    }

    function completeChart(silent) {
      image.src = "diagrams/structure-chart-answer.svg";
      chipRow.style.display = "none";
      checkBtn.style.display = "none";
      if (selectedNote) selectedNote.textContent = "";
      // the answer SVG already draws every box's label filled in — hide the
      // overlay buttons so their own text doesn't double up on top of it
      targets.forEach(function (t) { t.style.display = "none"; });
      feedback.hidden = false;
      feedback.className = "feedback correct";
      feedback.textContent = "Structure chart complete — check the diagnostic note on the diagram. (It shows Read then Compute left-to-right as one example; if you placed them the other way around, that's equally correct — a structure chart doesn't show order.)";
      followup.hidden = false;
      if (!silent) saveStore("sc-complete", true);
    }

    targets.forEach(renderTarget);
    if (loadStore("sc-complete")) {
      completeChart(true);
      return; // done — no need to wire up further interaction
    }

    // --- click-to-place (also the touch/keyboard-friendly path) -----------
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) { c.classList.remove("selected"); });
        chip.classList.add("selected");
        setSelected(chip.getAttribute("data-label"));
        feedback.hidden = true;
      });
      // --- native drag-and-drop -------------------------------------------
      chip.addEventListener("dragstart", function (e) {
        e.dataTransfer.setData("text/plain", chip.getAttribute("data-label"));
        e.dataTransfer.effectAllowed = "move";
        chip.classList.add("dragging");
      });
      chip.addEventListener("dragend", function () { chip.classList.remove("dragging"); });
    });

    targets.forEach(function (target) {
      target.addEventListener("click", function () {
        if (!selected) {
          feedback.hidden = false;
          feedback.className = "feedback incorrect";
          feedback.textContent = 'Click a chip below first (e.g. "Read sensors"), then click the box it belongs in — or just drag a chip straight onto a box.';
          return;
        }
        place(selected, target.id);
      });
      target.addEventListener("dragover", function (e) {
        e.preventDefault();
        target.classList.add("drag-over");
      });
      target.addEventListener("dragleave", function () { target.classList.remove("drag-over"); });
      target.addEventListener("drop", function (e) {
        e.preventDefault();
        target.classList.remove("drag-over");
        var label = e.dataTransfer.getData("text/plain");
        if (label) place(label, target.id);
      });
    });

    // --- check button: mark all three at once, rather than per-drop -------
    // Box (a) is a genuinely different level of the chart (outside the loop),
    // so it alone has one fixed correct answer. Boxes (b) and (c) are two
    // sibling children of "Main control loop" — a structure chart shows
    // decomposition, not sequence (that's a flowchart's job, as the section's
    // own intro says), so which one sits in (b) vs (c) is not meaningful and
    // both valid orderings of {Read sensors, Compute control values} across
    // them must mark as correct.
    var SIBLING_IDS = ["sc-b", "sc-c"];
    var SIBLING_SET = ["Read sensors", "Compute control values"].slice().sort();

    checkBtn.addEventListener("click", function () {
      targets.forEach(function (t) { t.classList.remove("checked-correct", "checked-wrong"); });

      var aTarget = document.getElementById("sc-a");
      var aPlaced = placements["sc-a"];
      var aCorrect = aPlaced === aTarget.getAttribute("data-answer");
      if (aPlaced) aTarget.classList.add(aCorrect ? "checked-correct" : "checked-wrong");

      var siblingPlaced = SIBLING_IDS.map(function (id) { return placements[id]; });
      var siblingFilledCount = siblingPlaced.filter(Boolean).length;
      var siblingCorrect = siblingFilledCount === 2 &&
        siblingPlaced.slice().sort().join("|") === SIBLING_SET.join("|");
      SIBLING_IDS.forEach(function (id) {
        if (placements[id]) document.getElementById(id).classList.add(siblingCorrect ? "checked-correct" : "checked-wrong");
      });

      var filledCount = (aPlaced ? 1 : 0) + siblingFilledCount;
      feedback.hidden = false;
      if (filledCount < targets.length) {
        feedback.className = "feedback incorrect";
        feedback.textContent = "Fill in all three boxes before checking — " + (targets.length - filledCount) + " still empty.";
      } else if (aCorrect && siblingCorrect) {
        completeChart(false);
      } else {
        feedback.className = "feedback incorrect";
        feedback.textContent = "Not quite — the red box(es) need a different chip. (Read sensors and Compute control values can go in either order between the two loop boxes — a structure chart doesn't show sequence — but Set-up / Calibration must be the box outside the loop.) Drag or click to fix, then check again.";
      }
    });
  }

  // ----------------------------------------------------------- click-the-lines
  function buildCodeLines() {
    var pre = document.getElementById("pseudocode");
    if (!pre) return;
    var modeButtons = document.querySelectorAll(".mode-btn");
    var lines = Array.prototype.slice.call(pre.querySelectorAll(".code-line"));
    var currentMode = "calibration";
    var selections = loadStore("code-selections") || { calibration: [], loop: [] };
    var feedback = document.getElementById("code-feedback");

    function refreshVisual() {
      lines.forEach(function (line) {
        line.classList.remove("sel-calibration", "sel-loop");
        var num = line.getAttribute("data-line");
        if (selections.calibration.indexOf(num) !== -1) line.classList.add("sel-calibration");
        if (selections.loop.indexOf(num) !== -1) line.classList.add("sel-loop");
      });
    }
    refreshVisual();

    modeButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentMode = btn.getAttribute("data-mode");
        modeButtons.forEach(function (b) { b.classList.toggle("active", b === btn); });
      });
    });

    lines.forEach(function (line) {
      if (line.getAttribute("data-role") === "none") return;
      line.addEventListener("click", function () {
        var num = line.getAttribute("data-line");
        var arr = selections[currentMode];
        var idx = arr.indexOf(num);
        if (idx === -1) arr.push(num); else arr.splice(idx, 1);
        saveStore("code-selections", selections);
        refreshVisual();
      });
    });

    var checkBtn = document.createElement("button");
    checkBtn.type = "button";
    checkBtn.className = "check-btn";
    checkBtn.textContent = "Check my answer";
    pre.parentNode.insertBefore(checkBtn, feedback);
    checkBtn.addEventListener("click", function () {
      var calibExpected = ["2", "3", "4"];
      var loopExpected = ["5", "6", "7", "8", "9", "10", "11", "12"];
      var calibOk = arraysEqualAsSets(selections.calibration, calibExpected);
      var loopOk = arraysEqualAsSets(selections.loop, loopExpected);
      feedback.hidden = false;
      if (calibOk && loopOk) {
        feedback.className = "feedback correct";
        feedback.textContent = "Correct — lines 2–4 are calibration; lines 5–12 (REPEAT...UNTIL stopped) are the main loop.";
      } else {
        feedback.className = "feedback incorrect";
        var msg = "Not quite yet. ";
        if (!calibOk) msg += "Calibration should be exactly the three variable-setup lines before REPEAT. ";
        if (!loopOk) msg += "The main loop is everything from REPEAT to UNTIL stopped, inclusive.";
        feedback.textContent = msg;
      }
    });
  }
  function arraysEqualAsSets(a, b) {
    if (a.length !== b.length) return false;
    var sa = a.slice().sort();
    var sb = b.slice().sort();
    return sa.every(function (v, i) { return v === sb[i]; });
  }

  // ------------------------------------------------------------ text-to-speech
  // Reads teaching content aloud via the browser's built-in speech synthesis
  // — no external service, works offline, and never touches .model-answer/
  // .feedback content, so it can't be used to skip a reveal gate (in
  // particular the protected Q12(b) commit-then-reveal).
  var TTS_READABLE_SELECTOR = [
    "h2", "h3", "p", "blockquote", ".mini-card", ".li-box", ".sc-box",
    ".hotspot-note", ".classify-item .snippet", ".video-link-caption",
    ".takeaway", "table.glossary", ".video-fallback"
  ].join(",");
  var ttsCurrentBtn = null;

  // Checks the actual hidden mechanisms this page uses (a gated reveal, an
  // unopened hotspot note, a collapsed <details> fallback) rather than a
  // layout-based visibility check — buildTextToSpeech() runs once at page
  // load, while every section except the active one is still display:none,
  // so an offsetWidth/offsetHeight check would (and initially did) read
  // everything on the page as "invisible" and silently collect nothing.
  function isGatedOrCollapsed(el, withRevealables) {
    if (withRevealables && (el.classList.contains("hotspot-note") || el.classList.contains("video-fallback"))) {
      return !!el.closest(".model-answer, .feedback");
    }
    return !!el.closest(".model-answer, .feedback, [hidden], details:not([open])");
  }

  // Actual readable text for an element — a manual tree-walk that inserts a
  // break after every block-level child and after <br>, rather than relying
  // on rendered layout (innerText) or plain concatenation (textContent,
  // which would run a card's heading straight into its body text with no
  // separator at all: "A room" + "Setpoint: 21 °C" → "A roomSetpoint: 21
  // °C"). Deliberately layout-independent — the work-summary builder needs
  // this to work on every section, not just the one currently visible, and
  // an innerText-based version would silently read empty for anything
  // display:none at the time (which is every section except the active one).
  var TTS_BLOCK_TAGS = { H1: 1, H2: 1, H3: 1, H4: 1, P: 1, DIV: 1, LI: 1, BLOCKQUOTE: 1, TR: 1 };
  function readableTextOf(el) {
    var out = [];
    (function walk(node) {
      if (node.nodeType === 3) { out.push(node.textContent); return; }
      if (node.nodeType !== 1) return;
      if (node.tagName === "BR") { out.push("\n"); return; }
      Array.prototype.forEach.call(node.childNodes, walk);
      if (TTS_BLOCK_TAGS[node.tagName]) out.push("\n");
    })(el);
    // strips a block's own leading "🔊"/"⏹" read-aloud button, present once
    // this module has inserted one into it, so re-reading a block's text
    // live never speaks/writes the button's own glyph as part of the content
    // (🔊|⏹) as alternation, not a [🔊⏹] character class — 🔊 is a surrogate
    // pair (outside the BMP), and a character class without the /u flag
    // matches individual UTF-16 code units, silently splitting it into two
    // orphaned halves and leaving a stray "�" behind instead of stripping it.
    // Join the block's lines with sentence punctuation, but don't add a
    // second full stop to a line that already ends in one — a blanket
    // /\n+/ → ". " replacement produced "…how each part behaves.." and
    // "…runs only once?." at every block boundary, and a "\n \n" run (a
    // newline, whitespace text node, newline) produced a stray ". . ".
    var parts = out.join("").split("\n").map(function (s) {
      return s.replace(/[ \t]+/g, " ").trim();
    }).filter(Boolean);
    var text = "";
    parts.forEach(function (p) {
      if (!text) { text = p; return; }
      text += (/[.!?:;,]$/.test(text) ? " " : ". ") + p;
    });
    return text.replace(/^(🔊|⏹)\s*\.?\s*/, "").trim();
  }

  // Layout-independent existence check — used only to decide, at setup
  // time (while most sections are still display:none), which elements have
  // real content worth giving a button to. innerText would read empty for
  // every hidden section, which is exactly the bug this avoids.
  function hasReadableText(el) {
    return !!el.textContent.replace(/\s+/g, " ").trim();
  }

  // Every distinct readable chunk in a section, in document order, with
  // nested duplicates removed (e.g. a card's own heading isn't returned
  // separately from the card's full text) and gated content excluded.
  function collectReadableBlocks(section, withRevealables) {
    var seen = [];
    section.querySelectorAll(TTS_READABLE_SELECTOR).forEach(function (el) {
      if (isGatedOrCollapsed(el, withRevealables)) return;
      if (seen.some(function (s) { return s.contains(el) || el.contains(s); })) return;
      if (hasReadableText(el)) seen.push(el);
    });
    return seen;
  }

  function stopSpeech() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (ttsCurrentBtn) {
      ttsCurrentBtn.textContent = ttsCurrentBtn.getAttribute("data-idle-label");
      ttsCurrentBtn.classList.remove("speaking");
    }
    ttsCurrentBtn = null;
  }

  // textFn is called AFTER stopSpeech() resets any other currently-speaking
  // button back to its idle label — text is a lazy function, not a
  // pre-computed string, specifically so that reset happens first. Reading
  // it before stopSpeech() ran (the original bug here) could pick up
  // another button's live "⏹" glyph if that button's container text is
  // itself part of what's being read (e.g. reading a whole section while
  // one of its own card buttons is still mid-speech).
  function speakWith(btn, idleLabel, textFn) {
    if (ttsCurrentBtn === btn) { stopSpeech(); return; }
    stopSpeech();
    var text = typeof textFn === "function" ? textFn() : textFn;
    if (!text) return;
    var utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-AU";
    utter.rate = 0.95;
    utter.onend = function () { if (ttsCurrentBtn === btn) stopSpeech(); };
    utter.onerror = function () { if (ttsCurrentBtn === btn) stopSpeech(); };
    ttsCurrentBtn = btn;
    btn.setAttribute("data-idle-label", idleLabel);
    btn.textContent = "⏹";
    btn.classList.add("speaking");
    window.speechSynthesis.speak(utter);
  }

  function buildTextToSpeech() {
    if (!("speechSynthesis" in window)) return; // feature not available — no buttons added
    document.querySelectorAll(".site-section").forEach(function (section) {
      var sectionBtn = document.createElement("button");
      sectionBtn.type = "button";
      sectionBtn.className = "tts-btn";
      sectionBtn.setAttribute("data-idle-label", "🔊 Read this whole page aloud");
      sectionBtn.textContent = "🔊 Read this whole page aloud";
      section.insertBefore(sectionBtn, section.firstChild);
      sectionBtn.addEventListener("click", function () {
        speakWith(sectionBtn, "🔊 Read this whole page aloud", function () {
          // Recomputed live (not cached from setup) so content revealed
          // after page load — e.g. a Section 3 hotspot note the student has
          // since clicked open — is picked up correctly, and so any other
          // button's label has already been reset back to idle by the
          // stopSpeech() that ran just before this function is called.
          var blocks = collectReadableBlocks(section).filter(function (el) { return el.tagName !== "H2"; });
          return blocks.map(readableTextOf).join(". ");
        });
      });

      // One small per-block button each, so a student can replay just one
      // card or paragraph instead of sitting through the whole section again.
      // Decided once at setup time, from what's collectible right now — a
      // hotspot note that's still closed at this point won't get its own
      // dedicated button, but the whole-page button above still reads it
      // once it's opened, via the live recompute.
      collectReadableBlocks(section).filter(function (el) { return el.tagName !== "H2"; }).forEach(function (block) {
        var blockBtn = document.createElement("button");
        blockBtn.type = "button";
        blockBtn.className = "tts-block-btn";
        blockBtn.setAttribute("data-idle-label", "🔊");
        blockBtn.textContent = "🔊";
        blockBtn.setAttribute("aria-label", "Read this part aloud");
        blockBtn.title = "Read this part aloud";
        block.insertBefore(blockBtn, block.firstChild);
        blockBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          speakWith(blockBtn, "🔊", function () { return readableTextOf(block); });
        });
      });
    });
  }

  // --------------------------------------------------------------- navigation
  var SECTION_IDS = [
    "sec-1", "sec-2", "sec-3", "sec-4", "sec-5",
    "sec-6", "sec-7", "sec-8", "sec-9", "sec-ext", "sec-wrap"
  ];

  function goToSection(id) {
    stopSpeech();
    SECTION_IDS.forEach(function (sid) {
      var el = document.getElementById(sid);
      if (el) el.classList.toggle("active", sid === id);
    });
    updateNav(id);
    saveStore("current-section", id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateNav(activeId) {
    var visited = loadStore("visited-sections") || [];
    if (visited.indexOf(activeId) === -1) {
      visited.push(activeId);
      saveStore("visited-sections", visited);
    }
    document.querySelectorAll("#nav-list button").forEach(function (btn) {
      var sid = btn.getAttribute("data-nav");
      btn.classList.toggle("active", sid === activeId);
      btn.classList.toggle("visited", visited.indexOf(sid) !== -1);
    });
    var idx = SECTION_IDS.indexOf(activeId);
    var pct = SECTION_IDS.length <= 1 ? 100 : (idx / (SECTION_IDS.length - 1)) * 100;
    var fill = document.getElementById("progress-fill");
    if (fill) fill.style.width = pct + "%";
  }

  function buildNav() {
    var navList = document.getElementById("nav-list");
    SECTION_IDS.forEach(function (sid, i) {
      var section = document.getElementById(sid);
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-nav", sid);
      btn.textContent = (i + 1) + ". " + (section ? section.getAttribute("data-title") : sid);
      btn.addEventListener("click", function () { goToSection(sid); });
      li.appendChild(btn);
      navList.appendChild(li);
    });
  }

  function wireNextButtons() {
    document.querySelectorAll("[data-next]").forEach(function (btn) {
      btn.addEventListener("click", function () { goToSection(btn.getAttribute("data-next")); });
    });
  }

  // -------------------------------------------------------------- work summary
  // Downloadable/printable record of everything the student has answered —
  // built generically from this page's own DOM and localStorage state
  // (reusing each field's own <label>, each quiz's own question <p>, and the
  // same completion checks each exercise already uses) rather than a
  // hand-written per-question summary, so it can't drift out of sync with
  // the actual questions. Uses the browser's native print dialog (Save as
  // PDF) rather than generating a file directly — works in every browser
  // with no extra library, and side-steps this environment's sandboxed
  // download restrictions entirely.
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function labelFor(el) {
    if (el.id) {
      var lbl = document.querySelector('label[for="' + el.id + '"]');
      if (lbl) return lbl.textContent.replace(/\s+/g, " ").trim();
    }
    var wrap = el.closest("label");
    if (wrap) return wrap.textContent.replace(/\s+/g, " ").trim();
    return el.getAttribute("data-store");
  }

  function questionStemFor(block) {
    var wrap = block.closest(".quiz-block, .commit-block") || block.parentElement;
    var p = wrap ? wrap.querySelector("p") : null;
    // via readableTextOf, not raw textContent — that <p> may itself have a
    // TTS read-aloud button inserted into it as its first child, and a raw
    // textContent read would include that button's own glyph as part of
    // the question stem text.
    return p ? readableTextOf(p) : "Question";
  }

  // A question stem that already ends in its own punctuation ("…what's
  // missing?") gets an em-dash lead-in rather than a colon, which would
  // print as "…what's missing?: ".
  function stemLead(stem) {
    if (/[:;]$/.test(stem)) return escapeHtml(stem) + " ";
    return escapeHtml(stem) + (/[.!?]$/.test(stem) ? " — " : ": ");
  }

  function sectionSummaryItems(section) {
    var items = [];

    section.querySelectorAll("[data-store]").forEach(function (el) {
      if (el.type === "checkbox") {
        items.push(stemLead(labelFor(el)) + (el.checked ? "ticked" : '<span class="unanswered-tag">not ticked</span>'));
      } else {
        var val = el.value.trim();
        items.push(stemLead(labelFor(el)) + (val ? escapeHtml(val) : '<span class="unanswered-tag">not answered yet</span>'));
      }
    });

    section.querySelectorAll(".single-select[id]").forEach(function (block) {
      var stem = questionStemFor(block);
      var chosen = loadStore("single-" + block.id);
      if (!chosen) { items.push(stemLead(stem) + '<span class="unanswered-tag">not answered yet</span>'); return; }
      var chosenBtn = block.querySelector('[data-value="' + chosen + '"]');
      var chosenLabel = chosenBtn ? chosenBtn.textContent.trim() : chosen;
      var isCorrect = chosen === block.getAttribute("data-correct");
      items.push(stemLead(stem) + 'you chose "' + escapeHtml(chosenLabel) + '" <span class="' +
        (isCorrect ? "correct-tag" : "incorrect-tag") + '">(' + (isCorrect ? "correct" : "check this one") + ")</span>");
    });

    if (section.id === "sec-2") {
      var cCorrect = 0, cAttempted = 0;
      CLASSIFY_ITEMS.forEach(function (item) {
        var val = loadStore("classify-" + item.id);
        if (val) { cAttempted++; if ((val === "control") === item.isControl) cCorrect++; }
      });
      items.push("Classify exercise: " + cCorrect + "/" + CLASSIFY_ITEMS.length + " correct (" + cAttempted + "/" + CLASSIFY_ITEMS.length + " attempted)");
    }
    if (section.id === "sec-4") {
      var msWrap = document.getElementById("match-setpoint");
      if (msWrap) {
        var pairs = JSON.parse(msWrap.getAttribute("data-pairs"));
        var placements = loadStore("match-setpoint-placements") || {};
        var mCorrect = pairs.filter(function (p) { return placements[p.target] === p.label; }).length;
        items.push("Setpoint/error matching: " + mCorrect + "/" + pairs.length + " correct");
      }
    }
    if (section.id === "sec-6") {
      items.push("Structure chart: " + (loadStore("sc-complete") ? '<span class="correct-tag">complete and correct</span>' : "not yet complete"));
    }
    if (section.id === "sec-7") {
      var placed = loadStore("cost-match") || [];
      items.push("Cost-matching exercise: " + placed.length + "/3 chips placed");
    }
    if (section.id === "sec-8") {
      var sel = loadStore("code-selections") || { calibration: [], loop: [] };
      var calibOk = arraysEqualAsSets(sel.calibration || [], ["2", "3", "4"]);
      var loopOk = arraysEqualAsSets(sel.loop || [], ["5", "6", "7", "8", "9", "10", "11", "12"]);
      items.push("Trace-the-pseudocode exercise: " + ((calibOk && loopOk) ? '<span class="correct-tag">correct</span>' : "not yet correct"));
    }
    return items;
  }

  // Diagrams worth carrying into printed notes, keyed by section id. The
  // structure chart picks whichever image the student actually finished
  // with (blank if they haven't completed it yet, the filled-in answer if
  // they have) rather than always showing one or the other.
  function summaryDiagramsFor(sid) {
    if (sid === "sec-3") {
      return ['<img class="summary-diagram" src="diagrams/control-algorithm-shape.svg" alt="Control algorithm shape: Set-up/Calibration runs once, outside a loop that reads, computes and outputs.">'];
    }
    if (sid === "sec-6") {
      var src = loadStore("sc-complete") ? "diagrams/structure-chart-answer.svg" : "diagrams/structure-chart-blank.svg";
      return ['<img class="summary-diagram" src="' + src + '" alt="Structure chart for a control algorithm">'];
    }
    // Without this the printed notes said "Here is a simple line-following
    // control algorithm in pseudocode" and then showed no pseudocode — the
    // questions under it (setpoint, zig-zag, the calibration-inside-the-loop
    // trap) are unrevisable on paper without the listing. Escaped, and read
    // from the line spans rather than the <pre>'s innerHTML, so the
    // mode-toggle buttons and any marking classes stay out of it.
    if (sid === "sec-8") {
      var lines = document.querySelectorAll("#pseudocode .code-line");
      if (!lines.length) return [];
      var code = Array.prototype.map.call(lines, function (l) {
        return escapeHtml(l.textContent.replace(/\s+$/, ""));
      }).join("\n");
      return ['<pre class="summary-code">' + code + "</pre>"];
    }
    return [];
  }

  function renderWorkSummaryHtml(name) {
    var html = "<h4>" + escapeHtml(name || "(name not entered)") + "</h4>";
    html += '<p class="summary-meta">Programming Mechatronics · Lesson 9 — Control Algorithms · ' +
      new Date().toLocaleDateString("en-AU") + ". Each section shows the lesson notes, then what you answered.</p>";
    SECTION_IDS.forEach(function (sid, i) {
      var section = document.getElementById(sid);
      if (!section) return;
      // data-summary-skip marks on-screen-only exercise mechanics ("Drag
      // each chip into the box it belongs in", "Opens on YouTube in a new
      // tab") — still read aloud and still shown on the page, but there is
      // nothing left to drag or click on a printout, so they are dropped
      // from the notes rather than duplicated onto paper.
      // Question stems inside a quiz/commit block are dropped from the notes
      // because they come back verbatim under "Your answers" with the
      // student's choice attached — printing them twice, once with no answer
      // beside it, just padded the notes.
      var noteBlocks = collectReadableBlocks(section, true).filter(function (el) {
        return el.tagName !== "H2" &&
          !el.closest("[data-summary-skip]") &&
          !el.closest(".quiz-block, .commit-block");
      });
      var notes = noteBlocks.map(readableTextOf).filter(Boolean);
      var diagrams = summaryDiagramsFor(sid);
      var items = sectionSummaryItems(section);
      if (!notes.length && !diagrams.length && !items.length) return;

      html += "<h5>" + (i + 1) + ". " + escapeHtml(section.getAttribute("data-title")) + "</h5>";
      if (notes.length) {
        html += '<div class="summary-notes"><p>' + notes.map(escapeHtml).join("</p><p>") + "</p></div>";
      }
      diagrams.forEach(function (img) { html += img; });
      if (items.length) {
        html += '<p class="summary-subhead">Your answers</p><ul><li>' + items.join("</li><li>") + "</li></ul>";
      }
    });
    return html;
  }

  function wireWorkSummary() {
    var nameInput = document.getElementById("summary-name");
    var btn = document.getElementById("summary-btn");
    var hint = document.getElementById("summary-name-hint");
    var out = document.getElementById("work-summary");
    if (!nameInput || !btn || !out) return;

    var savedName = loadStore("summary-name");
    if (savedName) nameInput.value = savedName;

    function updateGate() {
      var has = nameInput.value.trim().length > 0;
      btn.disabled = !has;
      hint.hidden = has;
    }
    nameInput.addEventListener("input", function () {
      saveStore("summary-name", nameInput.value);
      updateGate();
    });
    updateGate();

    btn.addEventListener("click", function () {
      out.innerHTML = renderWorkSummaryHtml(nameInput.value);
      out.hidden = false;
      out.classList.add("ready");
      window.print();
    });
  }

  function wireReset() {
    var btn = document.getElementById("reset-btn");
    btn.addEventListener("click", function () {
      if (window.confirm("Reset all your answers and progress on this page? This can't be undone.")) {
        clearAllStore();
        window.location.reload();
      }
    });
  }

  // --------------------------------------------------------------------- init
  document.addEventListener("DOMContentLoaded", function () {
    buildClassifyGrid();
    buildSetpointMatch();
    buildCostMatch();
    buildStructureChart();
    buildCodeLines();
    buildNav();
    buildTextToSpeech();

    wireTextInputs();
    wireRevealButtons();
    wireNumericCheckers();
    wireSingleSelects();
    wireHotspots();
    wireNextButtons();
    wireReset();
    wireWorkSummary();

    var last = loadStore("current-section") || "sec-1";
    if (SECTION_IDS.indexOf(last) === -1) last = "sec-1";
    goToSection(last);
  });
})();
