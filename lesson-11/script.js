(function () {
  "use strict";

  var STORE_PREFIX = "l11-";

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

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ------------------------------------------------------- text/number inputs
  function wireTextInputs() {
    document.querySelectorAll("[data-store]").forEach(function (el) {
      if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return;
      if (el.type === "checkbox") return;
      var key = el.getAttribute("data-store");
      var saved = loadStore(key);
      if (saved !== null) el.value = saved;
      el.addEventListener("input", function () { saveStore(key, el.value); });
    });
  }

  // ------------------------------------------------------------ reveal buttons
  function wireRevealButtons() {
    document.querySelectorAll("[data-reveal]").forEach(function (btn) {
      var targetId = btn.getAttribute("data-reveal");
      var stateKey = "revealed-" + targetId;
      var target = document.getElementById(targetId);
      if (!target) return;
      // "below", not "above" — every .model-answer sits after its own button in
      // the markup, so the revealed text appears underneath it. (Lesson 9's
      // site still says "above"; Lesson 10's fixed it, and so does this one.)
      var doneLabel = "Model answer shown below";
      if (loadStore(stateKey)) { target.hidden = false; btn.textContent = doneLabel; btn.disabled = true; }
      btn.addEventListener("click", function () {
        target.hidden = false;
        btn.textContent = doneLabel;
        btn.disabled = true;
        saveStore(stateKey, true);
      });
    });
  }

  // ------------------------------------------------------------- single-select
  function wireSingleSelects() {
    document.querySelectorAll(".single-select").forEach(function (block) {
      // Randomise option order on every load — the correct answer sitting in
      // the same position every time turns a check into a position-memory
      // exercise instead of a real one.
      shuffle(Array.prototype.slice.call(block.querySelectorAll("button")))
        .forEach(function (el) { block.appendChild(el); }); // appendChild moves an existing node
      var id = block.id;
      var correct = block.getAttribute("data-correct");
      var extra = block.getAttribute("data-explain");
      var feedback = id ? document.getElementById(id + "-feedback") : null;
      var explain = id ? document.getElementById(id + "-explain") : null;
      var stateKey = "single-" + (id || Math.random());

      function applyAnswer(value) {
        block.classList.add("answered");
        block.querySelectorAll("button").forEach(function (b) {
          b.disabled = true;
          if (b.getAttribute("data-value") === correct) b.classList.add("correct");
          else if (b.getAttribute("data-value") === value) b.classList.add("incorrect");
        });
        var isRight = value === correct;
        if (feedback) {
          feedback.hidden = false;
          feedback.className = "feedback " + (isRight ? "correct" : "incorrect");
          feedback.textContent = (isRight ? "Correct." : "Not quite — the highlighted option is correct.") +
            (extra ? " " + extra : "");
        }
        if (explain) explain.hidden = false;
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

  // ------------------------------------------------------ placement exercises
  // Used twice on this page — matching the three response curves to their
  // algorithms (§2) and matching each PID term to the weakness it fixes (§8).
  // Both work the same way: drag a chip, or click a chip then click a box, and
  // check the whole set at once so a chip in the wrong place can be moved
  // without penalty. Each has one chip that belongs nowhere, which is the
  // point of the exercise rather than a trick: in §2 it is open loop (no
  // measurement, so no response curve exists at all), and in §8 it is
  // proportional (the term that causes both weaknesses rather than fixing
  // either).
  var PLACEMENT_MESSAGES = {
    curves: {
      done: "All three are right. Now look at what separates them: one never stops correcting, one gives up as it gets close, and one arrives and stays.",
      wrong: "Not quite — the red box needs a different chip. Read the shapes again: which line never settles, which settles short of the setpoint, and which settles on it? One chip belongs in none of the boxes.",
      empty: "Fill in all three boxes before checking — "
    },
    pid: {
      done: "Both right. One term closes a gap that will not close on its own; the other stops the system arriving too hard.",
      wrong: "Not quite — the red box needs a different term. One weakness is about never quite arriving; the other is about arriving too fast. One term fixes neither.",
      empty: "Fill in both boxes before checking — "
    }
  };

  function buildPlacementExercise(wrap) {
    var name = wrap.getAttribute("data-exercise");
    var msg = PLACEMENT_MESSAGES[name];
    var chipRow = document.getElementById(name + "-chips");
    var checkBtn = document.getElementById(name + "-check-btn");
    var feedback = document.getElementById(name + "-feedback");
    var selectedNote = document.getElementById(name + "-selected-note");
    var explain = document.getElementById(name + "-explain");
    if (!chipRow || !checkBtn || !feedback) return;

    var chips = shuffle(Array.prototype.slice.call(chipRow.querySelectorAll(".chip")));
    chips.forEach(function (c) { chipRow.appendChild(c); });
    var targets = Array.prototype.slice.call(wrap.querySelectorAll(".loop-target"));
    // An in-flow target carries its own placeholder text ("drop a term here");
    // an overlay target on a diagram is empty, because the diagram draws its
    // own dashed placeholder underneath.
    targets.forEach(function (t) { t.setAttribute("data-empty-label", t.textContent.trim()); });

    var selected = null;
    var placements = loadStore(name + "-placements") || {};

    function setSelected(label) {
      selected = label;
      if (selectedNote) {
        selectedNote.textContent = label
          ? ('Selected: "' + label + '" — now click (or drag) it onto the box it belongs in.')
          : "";
      }
    }
    function targetForChip(label) {
      return targets.filter(function (t) { return placements[t.id] === label; })[0] || null;
    }
    function renderTarget(t) {
      t.classList.remove("checked-correct", "checked-wrong");
      if (placements[t.id]) { t.classList.add("occupied"); t.textContent = placements[t.id]; }
      else { t.classList.remove("occupied"); t.textContent = t.getAttribute("data-empty-label"); }
    }
    function place(label, targetId) {
      var prev = targetForChip(label);
      if (prev && prev.id !== targetId) delete placements[prev.id];
      placements[targetId] = label;
      saveStore(name + "-placements", placements);
      targets.forEach(renderTarget);
      feedback.hidden = true;
      setSelected(null);
      chips.forEach(function (c) { c.classList.remove("selected"); });
    }
    function done(silent) {
      targets.forEach(function (t) { t.classList.remove("checked-wrong"); t.classList.add("checked-correct"); });
      chipRow.style.display = "none";
      checkBtn.style.display = "none";
      if (selectedNote) selectedNote.textContent = "";
      feedback.hidden = false;
      feedback.className = "feedback correct";
      feedback.textContent = msg.done;
      if (explain) explain.hidden = false;
      if (!silent) saveStore(name + "-done", true);
    }

    targets.forEach(renderTarget);

    if (loadStore(name + "-done")) { done(true); return; } // nothing left to place

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) { c.classList.remove("selected"); });
        chip.classList.add("selected");
        setSelected(chip.getAttribute("data-label"));
        feedback.hidden = true;
      });
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
          feedback.textContent = "Click a chip below first, then click the box it belongs in — or just drag a chip straight onto a box.";
          return;
        }
        place(selected, target.id);
      });
      target.addEventListener("dragover", function (e) { e.preventDefault(); target.classList.add("drag-over"); });
      target.addEventListener("dragleave", function () { target.classList.remove("drag-over"); });
      target.addEventListener("drop", function (e) {
        e.preventDefault();
        target.classList.remove("drag-over");
        var label = e.dataTransfer.getData("text/plain");
        if (label) place(label, target.id);
      });
    });

    checkBtn.addEventListener("click", function () {
      targets.forEach(function (t) { t.classList.remove("checked-correct", "checked-wrong"); });
      var filled = targets.filter(function (t) { return placements[t.id]; });
      if (filled.length < targets.length) {
        feedback.hidden = false;
        feedback.className = "feedback incorrect";
        feedback.textContent = msg.empty + (targets.length - filled.length) + " still empty.";
        return;
      }
      var allRight = targets.every(function (t) { return placements[t.id] === t.getAttribute("data-answer"); });
      if (allRight) { done(false); return; }
      targets.forEach(function (t) {
        t.classList.add(placements[t.id] === t.getAttribute("data-answer") ? "checked-correct" : "checked-wrong");
      });
      feedback.hidden = false;
      feedback.className = "feedback incorrect";
      feedback.textContent = msg.wrong;
    });
  }

  function buildPlacementExercises() {
    document.querySelectorAll(".place-exercise").forEach(buildPlacementExercise);
  }

  // ------------------------------------------------- the proportional table
  // Four cells checked in one go rather than one at a time, so the pattern
  // (each signal shrinking with the error) is visible before any marking
  // happens. The 0.2 row is the teaching payload: the answer is right and the
  // servo still cannot act on it.
  function wireNumericTable() {
    var wrap = document.getElementById("prop-table");
    if (!wrap) return;
    var btn = document.getElementById("prop-table-check");
    var feedback = document.getElementById("prop-table-feedback");
    var inputs = Array.prototype.slice.call(wrap.querySelectorAll("input[data-answer]"));

    function mark(silent) {
      var blank = 0, wrong = 0;
      inputs.forEach(function (input) {
        input.classList.remove("correct", "incorrect");
        var raw = input.value.trim();
        if (!raw) { blank++; return; }
        // A tolerance rather than ===: 0.4 typed as ".4" or "0.40" is the same
        // answer, and floating point makes an exact comparison a bad idea.
        if (Math.abs(parseFloat(raw) - parseFloat(input.getAttribute("data-answer"))) < 0.001) {
          input.classList.add("correct");
        } else { input.classList.add("incorrect"); wrong++; }
      });
      feedback.hidden = false;
      if (blank) {
        feedback.className = "feedback incorrect";
        feedback.textContent = "Fill in all four cells before checking — " + blank + " still empty.";
        return;
      }
      if (wrong) {
        feedback.className = "feedback incorrect";
        feedback.textContent = "The red cells are not right yet. Each one is just the error multiplied by k, and k is 2.";
        return;
      }
      feedback.className = "feedback correct";
      feedback.textContent = "All four correct. Now look at the last row: 0.4 is the right answer, and it is still too small to move the servo. That is the whole problem.";
      if (!silent) saveStore("prop-table-done", true);
    }

    if (loadStore("prop-table-done")) mark(true);
    btn.addEventListener("click", function () { mark(false); });
  }

  // ------------------------------------------------- classification checkpoint
  // Seven systems, each run through two questions in order: which algorithm,
  // then open or closed loop. Step 2 is disabled until step 1 is answered —
  // the same enforced-order pattern as Lesson 10's site, for the same reason:
  // the order is the procedure being taught, not a suggestion.
  //
  // The modern cruise control row carries algEither and accepts both
  // proportional and PID, because the behaviour as described genuinely does
  // not separate them. Marking one of those right would teach students to
  // guess the expected answer instead of reasoning from the behaviour.
  var ALG_OPTIONS = ["On/off (bang-bang)", "Proportional", "PID"];

  var SYSTEMS = [
    {
      id: "vacuum", name: "A robot vacuum's bump sensor",
      behaviour: "Drives forward until it hits a wall, reverses a fixed distance, turns, and drives forward again — over and over.",
      alg: "On/off (bang-bang)", loop: "closed",
      algWhy: "It only has two states — drive forward, or reverse and turn — and it switches sharply between them at a hard limit (the wall) rather than scaling its response to how close the wall is.",
      loopWhy: "It measures contact with an obstacle and changes what it does because of that measurement, so the loop is closed on whether it has hit something."
    },
    {
      id: "cruise", name: "An early cruise control system",
      behaviour: "Applies more or less throttle depending on how far the car's speed is from the set speed — but never quite reaches 100 km/h while climbing a hill.",
      alg: "Proportional", loop: "closed",
      algWhy: "The throttle scales with the size of the speed error, and a small permanent error remains under load. That leftover gap is the steady-state-error signature of proportional control with no integral term.",
      loopWhy: "Road speed is measured and the throttle changes because of the measurement."
    },
    {
      id: "printer", name: "A 3D printer's hot end",
      behaviour: "Rises quickly to its target temperature and settles there smoothly, with no overshoot and no oscillation.",
      alg: "PID", loop: "closed",
      algWhy: "Fast arrival with no overshoot is the derivative term damping the approach, and settling exactly on target rather than just below it is the integral term closing the gap.",
      loopWhy: "A thermistor measures the actual nozzle temperature and the heater output is recalculated from it on every pass."
    },
    {
      id: "timerheater", name: "A heater on a plug-in wall timer",
      behaviour: "Switches on at 6pm and off at 9pm, whatever the room temperature happens to be doing.",
      alg: "On/off (bang-bang)", loop: "open",
      algWhy: "Two states, full on or full off, with nothing in between.",
      loopWhy: "Nothing measures the room temperature. The clock decides, so the control action does not depend on the controlled variable at all — this is the one algorithm type that can be run open loop."
    },
    {
      id: "fridge", name: "A fridge",
      behaviour: "The compressor starts when the air reaches 5 °C and stops once it falls to 3 °C, then stays off until the air is back at 5 °C.",
      alg: "On/off (bang-bang)", loop: "closed",
      algWhy: "The compressor is either running or not — there is no part-speed. The two different switching temperatures are its hysteresis band, which is a modification of on/off control, not a fourth algorithm type.",
      loopWhy: "Air temperature is measured, and the compressor switches because of that measurement."
    },
    {
      id: "drone", name: "A camera drone holding its altitude in gusty wind",
      behaviour: "A gust pushes it down; it returns to exactly the set height, quickly, without bouncing above it.",
      alg: "PID", loop: "closed",
      algWhy: "Returning to exactly the set height rules out proportional alone (which would settle just below it), and returning without bouncing rules out on/off.",
      loopWhy: "Altitude is measured continuously and the motor speeds are recalculated from the error — it is correcting for a disturbance nobody told it about."
    },
    {
      id: "moderncruise", name: "A modern car's cruise control",
      behaviour: "Speeds up and slows down gently to hold the set speed over rolling hills.",
      algEither: ["Proportional", "PID"], loop: "closed",
      algWhy: "\"Gently\" rules out on/off — the response is scaled to the error rather than all-or-nothing. But the description never says whether it holds the set speed <em>exactly</em>, and that is the only thing that would separate proportional from PID. Both answers are correct here as long as you say what you assumed. (Real ones are PID.)",
      loopWhy: "Road speed is measured and the throttle depends on it."
    }
  ];

  function correctAlgs(sys) { return sys.algEither || [sys.alg]; }

  function buildClassification() {
    var grid = document.getElementById("sys-grid");
    if (!grid) return;
    // Rows are read aloud but kept out of the printed notes: the work summary
    // renders each system's result as one clean line instead of reprinting
    // every option's button text onto paper.
    grid.setAttribute("data-summary-skip", "");

    SYSTEMS.forEach(function (sys) {
      var row = document.createElement("div");
      row.className = "sys-row";
      row.id = "sys-" + sys.id;

      var name = document.createElement("div");
      name.className = "sys-name";
      name.textContent = sys.name;
      row.appendChild(name);

      var behaviour = document.createElement("p");
      behaviour.className = "sys-behaviour";
      behaviour.textContent = sys.behaviour;
      row.appendChild(behaviour);

      var step1 = document.createElement("div");
      step1.className = "sys-step";
      step1.innerHTML = '<p class="step-q">1 · Which algorithm is this?</p><div class="opt-row"></div>';
      row.appendChild(step1);

      var step2 = document.createElement("div");
      step2.className = "sys-step locked";
      step2.innerHTML = '<p class="step-q">2 · Is it closed loop or open loop?</p>' +
        '<div class="opt-row">' +
        '<button type="button" data-value="closed" disabled>Closed loop</button>' +
        '<button type="button" data-value="open" disabled>Open loop</button>' +
        "</div>";
      row.appendChild(step2);

      var verdict = document.createElement("div");
      verdict.className = "sys-verdict";
      verdict.hidden = true;
      row.appendChild(verdict);

      var opt1Row = step1.querySelector(".opt-row");
      shuffle(ALG_OPTIONS).forEach(function (text) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = text;
        b.setAttribute("data-value", text);
        opt1Row.appendChild(b);
      });

      var algKey = "cls-" + sys.id + "-alg";
      var loopKey = "cls-" + sys.id + "-loop";

      function applyAlg(value) {
        var right = correctAlgs(sys);
        opt1Row.querySelectorAll("button").forEach(function (b) {
          b.disabled = true;
          var v = b.getAttribute("data-value");
          if (sys.algEither) {
            if (v === value) b.classList.add("chosen");
          } else if (v === sys.alg) {
            b.classList.add("correct");
          } else if (v === value) {
            b.classList.add("incorrect");
          }
        });
        if (sys.algEither && right.indexOf(value) === -1) {
          // Still marked when the answer is outside the accepted pair — "either
          // of these two" is not "anything goes".
          opt1Row.querySelectorAll("button").forEach(function (b) {
            var v = b.getAttribute("data-value");
            if (v === value) { b.classList.remove("chosen"); b.classList.add("incorrect"); }
            else if (right.indexOf(v) !== -1) b.classList.add("correct");
          });
        }
        step2.classList.remove("locked");
        step2.querySelectorAll("button").forEach(function (b) { b.disabled = false; });
      }

      function applyLoop(value) {
        step2.querySelectorAll("button").forEach(function (b) {
          b.disabled = true;
          var v = b.getAttribute("data-value");
          if (v === sys.loop) b.classList.add("correct");
          else if (v === value) b.classList.add("incorrect");
        });
        verdict.hidden = false;
        var head = sys.algEither
          ? '<span class="verdict-word">Either proportional or PID</span> — '
          : '<span class="verdict-word">' + sys.alg + "</span> — ";
        verdict.className = "sys-verdict" + (sys.algEither ? " either" : "");
        verdict.innerHTML = head + sys.algWhy + "<br><br><strong>" +
          (sys.loop === "closed" ? "Closed loop" : "Open loop") + "</strong> — " + sys.loopWhy;
        row.classList.add("done");
        updateScore();
      }

      opt1Row.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          if (b.disabled) return;
          var v = b.getAttribute("data-value");
          saveStore(algKey, v);
          applyAlg(v);
          updateScore();
        });
      });
      step2.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          if (b.disabled) return;
          var v = b.getAttribute("data-value");
          saveStore(loopKey, v);
          applyLoop(v);
        });
      });

      grid.appendChild(row);

      var savedAlg = loadStore(algKey);
      if (savedAlg) {
        applyAlg(savedAlg);
        var savedLoop = loadStore(loopKey);
        if (savedLoop) applyLoop(savedLoop);
      }
    });

    updateScore();
  }

  function classificationTally() {
    var algCorrect = 0, algDone = 0, loopCorrect = 0, loopDone = 0;
    SYSTEMS.forEach(function (sys) {
      var a = loadStore("cls-" + sys.id + "-alg");
      var l = loadStore("cls-" + sys.id + "-loop");
      if (a) { algDone++; if (correctAlgs(sys).indexOf(a) !== -1) algCorrect++; }
      if (l) { loopDone++; if (l === sys.loop) loopCorrect++; }
    });
    return { algCorrect: algCorrect, algDone: algDone, loopCorrect: loopCorrect, loopDone: loopDone, total: SYSTEMS.length };
  }

  function updateScore() {
    var el = document.getElementById("sys-score");
    if (!el) return;
    var t = classificationTally();
    el.textContent = "Algorithm: " + t.algCorrect + "/" + t.total + " correct (" + t.algDone + " answered) · " +
      "Open/closed: " + t.loopCorrect + "/" + t.total + " correct (" + t.loopDone + " answered)";
  }

  // ------------------------------------------------------------ text-to-speech
  // Reads teaching content aloud via the browser's built-in speech synthesis —
  // no external service, works offline, and never touches .model-answer or
  // .feedback content, so it cannot be used to skip a reveal gate. A
  // .commit-explain is read only once the student has actually committed,
  // because until then it carries [hidden].
  var TTS_READABLE_SELECTOR = [
    "h2", "h3", "p", "blockquote", ".mini-card", ".li-box", ".sc-box",
    ".flow-box", ".commit-explain", ".sys-row", ".takeaway",
    // The four-step loop, the worked integral table and the closing glossary
    // are teaching content in elements the base selector does not reach — an
    // <ol> and two <table>s. Without them here they are silently dropped from
    // both the read-aloud and the printed notes.
    "ol.steps", "table.worked", "table.glossary",
    ".next-lesson-note", ".exit-ticket-note", ".video-fallback"
  ].join(",");
  var ttsCurrentBtn = null;

  // Checks the actual hidden mechanisms this page uses (a gated reveal, a
  // not-yet-earned explanation) rather than a layout-based visibility check —
  // buildTextToSpeech() runs once at page load, while every section except the
  // active one is still display:none, so an offsetWidth check would read the
  // whole page as invisible and collect nothing.
  //
  // withRevealables relaxes this for .video-fallback, and only for the printed
  // notes: it is the written alternative that has to carry the video's content
  // when the video cannot be reached, so leaving it out of a printout because
  // the student did not happen to open the <details> loses real teaching
  // content. Deliberately narrow — .model-answer and .commit-explain stay
  // gated, so nothing unearned can be reached through the print button.
  function isGatedOrCollapsed(el, withRevealables) {
    if (withRevealables && el.classList.contains("video-fallback")) {
      return !!el.closest(".model-answer, .feedback");
    }
    return !!el.closest(".model-answer, .feedback, [hidden], details:not([open])");
  }

  // Actual readable text for an element — a manual tree-walk inserting a break
  // after every block-level child and after <br>, rather than relying on
  // rendered layout (innerText) or plain concatenation (textContent, which runs
  // a card's heading straight into its body).
  var TTS_BLOCK_TAGS = { H1: 1, H2: 1, H3: 1, H4: 1, P: 1, DIV: 1, LI: 1, BLOCKQUOTE: 1, TR: 1 };
  function readableTextOf(el) {
    var out = [];
    (function walk(node) {
      if (node.nodeType === 3) { out.push(node.textContent); return; }
      if (node.nodeType !== 1) return;
      if (node.tagName === "BR") { out.push("\n"); return; }
      // Skip hidden DESCENDANTS, but never the element being read itself —
      // without the node !== el guard this returns empty for any hidden root.
      if (node !== el && node.hidden) return;
      Array.prototype.forEach.call(node.childNodes, walk);
      if (TTS_BLOCK_TAGS[node.tagName]) out.push("\n");
    })(el);
    var parts = out.join("").split("\n").map(function (s) {
      return s.replace(/[ \t]+/g, " ").trim();
    }).filter(Boolean);
    var text = "";
    parts.forEach(function (p) {
      if (!text) { text = p; return; }
      text += (/[.!?:;,]$/.test(text) ? " " : ". ") + p;
    });
    // (🔊|⏹) as ALTERNATION, not a [🔊⏹] character class — 🔊 is a surrogate
    // pair, and a character class without /u matches individual UTF-16 code
    // units, splitting it in half and leaving a replacement character behind.
    return text.replace(/^(🔊|⏹)\s*\.?\s*/, "").trim();
  }

  function hasReadableText(el) {
    return !!el.textContent.replace(/\s+/g, " ").trim();
  }

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

  // textFn is a lazy function, not a pre-computed string, so it runs AFTER
  // stopSpeech() has reset any other speaking button back to its idle label —
  // otherwise a live "⏹" glyph inside the content being read leaks into it.
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
    if (!("speechSynthesis" in window)) return; // feature unavailable — no buttons added
    document.querySelectorAll(".site-section").forEach(function (section) {
      var sectionBtn = document.createElement("button");
      sectionBtn.type = "button";
      sectionBtn.className = "tts-btn";
      sectionBtn.setAttribute("data-idle-label", "🔊 Read this whole page aloud");
      sectionBtn.textContent = "🔊 Read this whole page aloud";
      section.insertBefore(sectionBtn, section.firstChild);
      sectionBtn.addEventListener("click", function () {
        speakWith(sectionBtn, "🔊 Read this whole page aloud", function () {
          // Recomputed live rather than cached from setup, so content revealed
          // since page load — an earned commit explanation, a completed
          // classification row's verdict — is picked up.
          return collectReadableBlocks(section)
            .filter(function (el) { return el.tagName !== "H2"; })
            .map(readableTextOf).join(". ");
        });
      });

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
    "sec-1", "sec-2", "sec-3", "sec-4", "sec-5", "sec-6",
    "sec-7", "sec-8", "sec-9", "sec-10", "sec-ext", "sec-wrap"
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
  // A printable record of the lesson notes plus everything the student
  // answered, built generically from this page's own DOM and localStorage
  // (reusing each field's <label>, each quiz's own question <p>, and the
  // completion checks each exercise already uses) rather than a hand-written
  // per-question list, so it cannot drift out of sync with the questions.
  function labelFor(el) {
    if (el.id) {
      var lbl = document.querySelector('label[for="' + el.id + '"]');
      if (lbl) return lbl.textContent.replace(/\s+/g, " ").trim();
    }
    var wrap = el.closest("label");
    if (wrap) return wrap.textContent.replace(/\s+/g, " ").trim();
    return el.getAttribute("aria-label") || el.getAttribute("data-store");
  }

  function questionStemFor(block) {
    var wrap = block.closest(".quiz-block, .commit-block") || block.parentElement;
    var p = wrap ? wrap.querySelector("p") : null;
    // via readableTextOf, not raw textContent — that <p> may have a read-aloud
    // button inserted as its first child, whose glyph would fold into the stem.
    return p ? readableTextOf(p) : "Question";
  }

  // A stem already ending in its own punctuation gets an em-dash lead-in rather
  // than a colon, which would print as "...closed loop?: ".
  function stemLead(stem) {
    if (/[:;]$/.test(stem)) return escapeHtml(stem) + " ";
    return escapeHtml(stem) + (/[.!?]$/.test(stem) ? " — " : ": ");
  }

  function sectionSummaryItems(section) {
    var items = [];

    section.querySelectorAll("textarea[data-store], input[data-store]").forEach(function (el) {
      // The four table cells are reported as one line by the block below.
      if (el.closest("#prop-table")) return;
      var val = el.value.trim();
      items.push(stemLead(labelFor(el)) + (val ? escapeHtml(val) : '<span class="unanswered-tag">not answered yet</span>'));
    });

    section.querySelectorAll(".single-select[id]").forEach(function (block) {
      var stem = questionStemFor(block);
      var chosen = loadStore("single-" + block.id);
      if (!chosen) { items.push(stemLead(stem) + '<span class="unanswered-tag">not answered yet</span>'); return; }
      var chosenBtn = block.querySelector('[data-value="' + chosen + '"]');
      var chosenLabel = chosenBtn ? readableTextOf(chosenBtn) : chosen;
      var isCorrect = chosen === block.getAttribute("data-correct");
      items.push(stemLead(stem) + 'you chose "' + escapeHtml(chosenLabel) + '" <span class="' +
        (isCorrect ? "correct-tag" : "incorrect-tag") + '">(' + (isCorrect ? "correct" : "check this one") + ")</span>");
    });

    if (section.id === "sec-2") {
      items.push("Matching each response curve to its algorithm: " +
        (loadStore("curves-done") ? '<span class="correct-tag">all three placed correctly</span>' : "not yet complete"));
    }

    if (section.id === "sec-7") {
      var cells = Array.prototype.slice.call(document.querySelectorAll("#prop-table input[data-answer]"));
      var typed = cells.map(function (c) { return c.value.trim() || "—"; }).join(", ");
      items.push("Control signals for errors of 40, 10, 1 and 0.2 with k = 2: " + escapeHtml(typed) +
        (loadStore("prop-table-done") ? ' <span class="correct-tag">(all four correct)</span>' : ""));
    }

    if (section.id === "sec-8") {
      items.push("Matching each PID term to the weakness it fixes: " +
        (loadStore("pid-done") ? '<span class="correct-tag">both placed correctly</span>' : "not yet complete"));
    }

    if (section.id === "sec-9") {
      SYSTEMS.forEach(function (sys) {
        var a = loadStore("cls-" + sys.id + "-alg");
        var l = loadStore("cls-" + sys.id + "-loop");
        if (!a && !l) {
          items.push("<strong>" + escapeHtml(sys.name) + "</strong> — <span class=\"unanswered-tag\">not attempted</span>");
          return;
        }
        var line = "<strong>" + escapeHtml(sys.name) + "</strong> — algorithm: ";
        if (a) {
          var algOk = correctAlgs(sys).indexOf(a) !== -1;
          line += '"' + escapeHtml(a) + '" <span class="' + (algOk ? "correct-tag" : "incorrect-tag") + '">(' +
            (algOk
              ? (sys.algEither ? "either of proportional or PID is correct here — say what you assumed" : "correct")
              : "the answer is “" + escapeHtml(correctAlgs(sys).join(" or ")) + "”") + ")</span>";
        } else {
          line += '<span class="unanswered-tag">not named</span>';
        }
        if (l) {
          var loopOk = l === sys.loop;
          line += "; " + (l === "closed" ? "closed loop" : "open loop") +
            ' <span class="' + (loopOk ? "correct-tag" : "incorrect-tag") + '">(' +
            (loopOk ? "correct" : "the answer is " + (sys.loop === "closed" ? "closed loop" : "open loop")) + ")</span>";
        } else {
          line += '; <span class="unanswered-tag">open/closed not answered</span>';
        }
        items.push(line);
      });
      var t = classificationTally();
      items.push("<strong>Total</strong> — algorithm " + t.algCorrect + "/" + t.total +
        " correct, open/closed " + t.loopCorrect + "/" + t.total + " correct.");
    }

    return items;
  }

  // Diagrams worth carrying into printed revision notes, keyed by section.
  function summaryDiagramsFor(sid) {
    if (sid === "sec-2") {
      return ['<img class="summary-diagram" src="diagrams/three-responses.svg" alt="Three response curves against the same setpoint: one swinging past it repeatedly, one settling short of it, one settling on it.">'];
    }
    if (sid === "sec-5") {
      return ['<img class="summary-diagram" src="diagrams/hysteresis-band.svg" alt="Switching behaviour without a tolerance band against switching with a hysteresis band.">'];
    }
    if (sid === "sec-7") {
      return ['<img class="summary-diagram" src="diagrams/proportional-shrink.svg" alt="Shrinking errors multiplied by a gain of two, with the last control signal below the minimum the servo can act on.">'];
    }
    if (sid === "sec-10") {
      return ['<img class="summary-diagram" src="diagrams/not-pid.svg" alt="The pick-and-place trigger as a closed on/off loop, and the Lesson 19 movement function as an open loop sequence.">'];
    }
    return [];
  }

  function renderWorkSummaryHtml(name) {
    var html = "<h4>" + escapeHtml(name || "(name not entered)") + "</h4>";
    html += '<p class="summary-meta">Programming Mechatronics · Lesson 11 — Autonomous Control Features · ' +
      new Date().toLocaleDateString("en-AU") + ". Each section shows the lesson notes, then what you answered.</p>";
    SECTION_IDS.forEach(function (sid, i) {
      var section = document.getElementById(sid);
      if (!section) return;
      // data-summary-skip marks on-screen-only mechanics ("drag each chip into
      // the box", "the explanation only appears after you commit") — still
      // shown on the page and still read aloud, but there is nothing to drag on
      // a printout. Question stems inside a quiz or commit block are dropped
      // from the notes because they come back verbatim under "Your answers"
      // with the student's own choice attached.
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
    buildClassification();
    buildPlacementExercises();
    buildNav();

    wireTextInputs();
    wireRevealButtons();
    wireSingleSelects();
    wireNumericTable();
    wireNextButtons();
    wireReset();
    wireWorkSummary();

    buildTextToSpeech();   // last, so it sees every generated block

    var last = loadStore("current-section") || "sec-1";
    if (SECTION_IDS.indexOf(last) === -1) last = "sec-1";
    goToSection(last);
  });
})();
