(function () {
  "use strict";

  var STORE_PREFIX = "l10-";

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
      if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return; // .choice-select also uses data-store
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
      // "below", not "above" — every .model-answer sits after its own button
      // in the markup, so the revealed text appears underneath it.
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
  // Listeners registered by other modules that need to react when a specific
  // single-select is answered (the close-the-loop exercise waits on the
  // feedback-path question). Registered before wireSingleSelects() runs.
  var selectListeners = [];
  function onSelectAnswered(fn) { selectListeners.push(fn); }

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

      function applyAnswer(value, live) {
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
        selectListeners.forEach(function (fn) { fn(id, value, isRight, live); });
      }

      var saved = loadStore(stateKey);
      if (saved) applyAnswer(saved, false);

      block.querySelectorAll("button").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (block.classList.contains("answered")) return;
          var value = btn.getAttribute("data-value");
          saveStore(stateKey, value);
          applyAnswer(value, true);
        });
      });
    });
  }

  // ------------------------------------------------------------ choice-select
  // A pick with no right answer (the production-line recommendation). It is
  // recorded and reported back in the work summary, never marked, and it
  // selects which branch of the follow-up model answer is shown.
  function wireChoiceSelects() {
    document.querySelectorAll(".choice-select").forEach(function (block) {
      var key = block.getAttribute("data-store");

      function apply(value) {
        block.querySelectorAll("button").forEach(function (b) {
          b.classList.toggle("chosen", b.getAttribute("data-value") === value);
        });
        applyChoiceBranches(value);
      }

      var saved = key ? loadStore(key) : null;
      if (saved) apply(saved);
      else applyChoiceBranches(null);

      block.querySelectorAll("button").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var value = btn.getAttribute("data-value");
          if (key) saveStore(key, value);
          apply(value);
        });
      });
    });
  }

  // Shows only the branch matching the student's own recommendation. With no
  // recommendation recorded yet, both branches stay visible — the answer is
  // still useful, just not personalised.
  function applyChoiceBranches(value) {
    document.querySelectorAll("[data-choice-branch]").forEach(function (el) {
      el.hidden = !!value && el.getAttribute("data-choice-branch") !== value;
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

  // ------------------------------------------------- close-the-loop exercise
  // Two blocks are placed freely (drag, or click-a-chip-then-click-a-box —
  // both paths call the same place()), then checked in one go, so a chip in
  // the wrong box can be moved without penalty. Getting both right unlocks
  // the feedback-path question; getting THAT right swaps the diagram for the
  // completed one. The image swap is deliberately gated on the second step,
  // not the first: the answer diagram draws the return path, which would
  // hand over the answer to the question still being asked.
  function buildLoopExercise() {
    var wrap = document.querySelector(".loop-exercise");
    if (!wrap) return;
    var image = document.getElementById("loop-image");
    var chipRow = document.getElementById("loop-chips");
    var chips = shuffle(Array.prototype.slice.call(chipRow.querySelectorAll(".chip")));
    chips.forEach(function (c) { chipRow.appendChild(c); });
    var checkBtn = document.getElementById("loop-check-btn");
    var feedback = document.getElementById("loop-feedback");
    var selectedNote = document.getElementById("loop-selected-note");
    var returnQ = document.getElementById("loop-return-q");
    var targets = Array.prototype.slice.call(wrap.querySelectorAll(".loop-target"));
    var selected = null;
    var placements = loadStore("loop-placements") || {};

    function setSelected(label) {
      selected = label;
      if (selectedNote) selectedNote.textContent = label ? ('Selected: "' + label + '" — now click (or drag) it onto the box it belongs in.') : "";
    }
    function targetForChip(label) {
      return targets.filter(function (t) { return placements[t.id] === label; })[0] || null;
    }
    function renderTarget(t) {
      t.classList.remove("checked-correct", "checked-wrong");
      if (placements[t.id]) { t.classList.add("occupied"); t.textContent = placements[t.id]; }
      else { t.classList.remove("occupied"); t.textContent = ""; }
    }
    function place(label, targetId) {
      var prev = targetForChip(label);
      if (prev && prev.id !== targetId) delete placements[prev.id];
      placements[targetId] = label;
      saveStore("loop-placements", placements);
      targets.forEach(renderTarget);
      feedback.hidden = true;
      setSelected(null);
      chips.forEach(function (c) { c.classList.remove("selected"); });
    }

    function blocksDone(silent) {
      targets.forEach(function (t) { t.classList.remove("checked-wrong"); t.classList.add("checked-correct"); });
      chipRow.style.display = "none";
      checkBtn.style.display = "none";
      if (selectedNote) selectedNote.textContent = "";
      feedback.hidden = false;
      feedback.className = "feedback correct";
      feedback.textContent = "Both blocks are right. The measurement has to be taken by a sensor, and it has to arrive somewhere it can be compared with the setpoint — a timer belongs to neither job.";
      returnQ.hidden = false;
      if (!silent) saveStore("loop-blocks-done", true);
    }

    // Swapping in the completed diagram also hides the overlay buttons: the
    // answer SVG draws both boxes already labelled, and leaving the overlays
    // showing their own text on top of it doubles every label visibly.
    function loopComplete() {
      image.src = "diagrams/closed-loop-answer.svg";
      image.alt = "Completed closed loop block diagram: setpoint into a comparison, then controller, actuator and output, with a sensor measuring the output and feeding it back into the comparison.";
      targets.forEach(function (t) { t.style.display = "none"; });
    }

    targets.forEach(renderTarget);

    var alreadyDone = loadStore("loop-blocks-done");
    if (alreadyDone) blocksDone(true);

    // Restores the swapped-in answer diagram across a reload. Read from the
    // question's own saved answer rather than a second stored flag, so the
    // two can't drift apart.
    if (loadStore("single-ss-return") === "compare") loopComplete();
    onSelectAnswered(function (id, value, isRight) {
      if (id === "ss-return" && isRight) loopComplete();
    });

    if (alreadyDone) return; // no further placement interaction needed

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
          feedback.textContent = 'Click a chip below first (e.g. "Sensor"), then click the box it belongs in — or just drag a chip straight onto a box.';
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
        feedback.textContent = "Fill in both boxes before checking — " + (targets.length - filled.length) + " still empty.";
        return;
      }
      var allRight = targets.every(function (t) { return placements[t.id] === t.getAttribute("data-answer"); });
      if (allRight) { blocksDone(false); return; }
      targets.forEach(function (t) {
        t.classList.add(placements[t.id] === t.getAttribute("data-answer") ? "checked-correct" : "checked-wrong");
      });
      feedback.hidden = false;
      feedback.className = "feedback incorrect";
      feedback.textContent = "Not quite — the red box needs a different chip. Remember what each block has to do: one takes the measurement, one is where the measurement meets the setpoint. One chip belongs in neither. Drag or click to fix it, then check again.";
    });
  }

  // ------------------------------------------------- classification checkpoint
  // Nine systems, each run through the two-question test in order. Step 2 is
  // disabled until the controlled variable has been named, because "answer
  // question 1 first" is the procedure the whole lesson exists to install —
  // so the interface enforces the order rather than recommending it.
  //
  // Traffic lights and vehicle steering carry act:"either" and accept both
  // answers with an explanation of which system or design each one describes.
  // Marking one of them right would teach students to guess the expected
  // answer instead of running the test, which is the habit this lesson is
  // built to break.
  var SYSTEMS = [
    {
      id: "tv", name: "TV remote",
      options: [
        { text: "The TV's state — channel or volume", correct: true },
        { text: "The strength of the infrared signal", correct: false },
        { text: "The remote's battery level", correct: false }
      ],
      act: "no",
      justify: "The remote fires an infrared code and never checks whether the TV received it or acted on it. Point it at a wall and it behaves exactly the same."
    },
    {
      id: "cruise", name: "Vehicle cruise control",
      options: [
        { text: "Vehicle speed", correct: true },
        { text: "Engine temperature", correct: false },
        { text: "Fuel level", correct: false }
      ],
      act: "yes",
      justify: "It measures actual road speed and adjusts the throttle based on the difference from the set speed — which is why it can hold 100 km/h up a hill it was never told about."
    },
    {
      id: "steering", name: "Vehicle steering",
      options: [
        { text: "Direction — the car's position on the road", correct: true },
        { text: "The angle of the steering wheel", correct: false },
        { text: "Tyre pressure", correct: false }
      ],
      act: "either",
      eitherYes: "Closed loop — with the driver counted inside the system. The driver sees the car drifting, that's the error, and they correct it. The feedback path runs through a person.",
      eitherNo: "Open loop — the machine on its own. The mechanism turns the road wheels by the amount requested; nothing measures where the car actually ends up.",
      justify: "Both are right, and this is the most defensible \"it depends\" in the topic. In this course, classify the machine unless the question puts a person in it — so the expected default answer is open loop."
    },
    {
      id: "fan", name: "Ceiling fan speed control",
      options: [
        { text: "Blade speed", correct: true },
        { text: "Room temperature", correct: false },
        { text: "The current drawn by the motor", correct: false }
      ],
      act: "no",
      justify: "The switch selects a voltage, and that is all it does. Blade speed is never measured, so a fan slowed by a dusty motor or a stiff bearing just stays slow. (Room temperature is what the fan is <em>for</em> — it isn't what the switch controls.)"
    },
    {
      id: "aircon", name: "Air conditioner set to 22 °C",
      options: [
        { text: "Room air temperature", correct: true },
        { text: "Fan speed", correct: false },
        { text: "Refrigerant pressure", correct: false }
      ],
      act: "yes",
      justify: "A thermostat measures room temperature and switches cooling on or off based on the difference from the set temperature. Textbook closed loop."
    },
    {
      id: "washing", name: "Washing machine cycle timing",
      options: [
        { text: "Elapsed time, as a stand-in for how clean the clothes are", correct: true },
        { text: "Water level in the drum", correct: false },
        { text: "Drum rotation speed", correct: false }
      ],
      act: "no",
      justify: "It runs a fixed timed sequence and never measures how clean the clothes are. The water-level sensor is real, and it closes a real loop — but on a <em>different variable</em>, which is exactly the trap."
    },
    {
      id: "traffic", name: "Traffic light control",
      options: [
        { text: "Traffic flow — the queue at the intersection", correct: true },
        { text: "Which lamp is lit", correct: false },
        { text: "The time of day", correct: false }
      ],
      act: "either",
      eitherYes: "Closed loop — an actuated intersection. Inductive detector loops in the road, or pedestrian buttons, measure demand and extend or shorten the phases.",
      eitherNo: "Open loop — a fixed-timing intersection. Each phase runs for a set number of seconds regardless of whether anyone is waiting.",
      justify: "Both designs are real and common, so both answers are correct as long as you say which design you assumed. What would be wrong is picking one without saying."
    },
    {
      id: "armseq", name: "A robotic arm running a series of predetermined movements",
      options: [
        { text: "Gripper position", correct: true },
        { text: "The voltage sent to the motors", correct: false },
        { text: "How long the cycle takes", correct: false }
      ],
      act: "no",
      justify: "It repeats a stored sequence. Nothing measures whether the gripper actually reached each position, and nothing changes if it didn't. Programmable, precise and automatic — and still open loop."
    },
    {
      id: "linebot", name: "A line following robot",
      options: [
        { text: "Position relative to the line", correct: true },
        { text: "Battery voltage", correct: false },
        { text: "Wheel speed", correct: false }
      ],
      act: "yes",
      justify: "Light sensors measure how far off the line it is, and the steering changes in response. This is the one from Lesson 9's video."
    }
  ];

  function buildClassification() {
    var grid = document.getElementById("sys-grid");
    if (!grid) return;
    // Rows are read aloud but kept out of the printed notes: the summary
    // renders each system's result as a clean line instead of reprinting
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

      var step1 = document.createElement("div");
      step1.className = "sys-step";
      step1.innerHTML = '<p class="step-q">1 · What is the controlled variable?</p><div class="opt-row"></div>';
      row.appendChild(step1);

      var step2 = document.createElement("div");
      step2.className = "sys-step locked";
      step2.innerHTML = '<p class="step-q">2 · Does the system measure that variable, and change its own action because of the measurement?</p>' +
        '<div class="opt-row">' +
        '<button type="button" data-value="yes" disabled>Yes</button>' +
        '<button type="button" data-value="no" disabled>No</button>' +
        "</div>";
      row.appendChild(step2);

      var verdict = document.createElement("div");
      verdict.className = "sys-verdict";
      verdict.hidden = true;
      row.appendChild(verdict);

      var opt1Row = step1.querySelector(".opt-row");
      shuffle(sys.options).forEach(function (opt) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = opt.text;
        b.setAttribute("data-value", opt.text);
        opt1Row.appendChild(b);
      });

      var varKey = "cls-" + sys.id + "-var";
      var actKey = "cls-" + sys.id + "-act";

      function correctOptionText() {
        return sys.options.filter(function (o) { return o.correct; })[0].text;
      }

      function applyVar(value) {
        opt1Row.querySelectorAll("button").forEach(function (b) {
          b.disabled = true;
          var v = b.getAttribute("data-value");
          if (v === correctOptionText()) b.classList.add("correct");
          else if (v === value) b.classList.add("incorrect");
        });
        step2.classList.remove("locked");
        step2.querySelectorAll("button").forEach(function (b) { b.disabled = false; });
      }

      function applyAct(value) {
        step2.querySelectorAll("button").forEach(function (b) {
          b.disabled = true;
          var v = b.getAttribute("data-value");
          if (sys.act === "either") {
            if (v === value) b.classList.add("chosen");
          } else if (v === sys.act) {
            b.classList.add("correct");
          } else if (v === value) {
            b.classList.add("incorrect");
          }
        });
        verdict.hidden = false;
        if (sys.act === "either") {
          verdict.className = "sys-verdict either";
          verdict.innerHTML = '<span class="verdict-word">Either — and you have just said which.</span> ' +
            (value === "yes" ? sys.eitherYes : sys.eitherNo) + " " + sys.justify;
        } else {
          verdict.className = "sys-verdict";
          var word = sys.act === "yes" ? "Closed loop" : "Open loop";
          verdict.innerHTML = '<span class="verdict-word">' + word + "</span> — " + sys.justify;
        }
        row.classList.add("done");
        updateScore();
      }

      opt1Row.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          if (b.disabled) return;
          var v = b.getAttribute("data-value");
          saveStore(varKey, v);
          applyVar(v);
          updateScore();
        });
      });
      step2.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          if (b.disabled) return;
          var v = b.getAttribute("data-value");
          saveStore(actKey, v);
          applyAct(v);
        });
      });

      grid.appendChild(row);

      var savedVar = loadStore(varKey);
      if (savedVar) {
        applyVar(savedVar);
        var savedAct = loadStore(actKey);
        if (savedAct) applyAct(savedAct);
      }
    });

    updateScore();
  }

  function classificationTally() {
    var varsCorrect = 0, varsDone = 0, verdictsCorrect = 0, verdictsDone = 0;
    SYSTEMS.forEach(function (sys) {
      var v = loadStore("cls-" + sys.id + "-var");
      var a = loadStore("cls-" + sys.id + "-act");
      if (v) {
        varsDone++;
        if (v === sys.options.filter(function (o) { return o.correct; })[0].text) varsCorrect++;
      }
      if (a) {
        verdictsDone++;
        if (sys.act === "either" || a === sys.act) verdictsCorrect++;
      }
    });
    return { varsCorrect: varsCorrect, varsDone: varsDone, verdictsCorrect: verdictsCorrect, verdictsDone: verdictsDone, total: SYSTEMS.length };
  }

  function updateScore() {
    var el = document.getElementById("sys-score");
    if (!el) return;
    var t = classificationTally();
    el.textContent = "Controlled variables: " + t.varsCorrect + "/" + t.total + " correct (" + t.varsDone + " answered) · " +
      "Verdicts: " + t.verdictsCorrect + "/" + t.total + " correct (" + t.verdictsDone + " answered)";
  }

  // ------------------------------------------------------------ text-to-speech
  // Reads teaching content aloud via the browser's built-in speech synthesis
  // — no external service, works offline, and never touches .model-answer or
  // .feedback content, so it can't be used to skip a reveal gate (the four
  // commit-then-reveal questions in particular). A .commit-explain is read
  // only once the student has actually committed, because until then it
  // carries [hidden].
  var TTS_READABLE_SELECTOR = [
    "h2", "h3", "p", "blockquote", ".mini-card", ".li-box", ".sc-box",
    ".hotspot-note", ".commit-explain", ".sys-row", ".takeaway", "table.glossary",
    ".next-lesson-note", ".exit-ticket-note", ".video-fallback"
  ].join(",");
  var ttsCurrentBtn = null;

  // Checks the actual hidden mechanisms this page uses (a gated reveal, an
  // unopened hotspot note, a not-yet-earned explanation) rather than a
  // layout-based visibility check — buildTextToSpeech() runs once at page
  // load, while every section except the active one is still display:none,
  // so an offsetWidth/offsetHeight check would read the whole page as
  // "invisible" and silently collect nothing.
  //
  // withRevealables relaxes this for two classes, and only for the printed
  // notes. Both are click-to-reveal *teaching* content rather than gates on an
  // answer: a .hotspot-note says what a setpoint or an actuator IS, and a
  // .video-fallback is the written alternative that has to carry a video's
  // content when the video can't be reached. Leaving them out of a printout
  // because the student happened not to click produced revision notes with one
  // orphaned block description, the other three missing, and no trace of what
  // either video showed. Deliberately narrow: .model-answer and
  // .commit-explain stay gated, so nothing a student has not earned can be
  // reached through the print button.
  function isGatedOrCollapsed(el, withRevealables) {
    if (withRevealables && (el.classList.contains("hotspot-note") || el.classList.contains("video-fallback"))) {
      return !!el.closest(".model-answer, .feedback");
    }
    return !!el.closest(".model-answer, .feedback, [hidden], details:not([open])");
  }

  // Actual readable text for an element — a manual tree-walk inserting a
  // break after every block-level child and after <br>, rather than relying
  // on rendered layout (innerText) or plain concatenation (textContent,
  // which runs a card's heading straight into its body: "Toaster on a
  // timer" + "Runs the element..." with no separator). Deliberately
  // layout-independent: the work-summary builder needs it to work on every
  // section, not just the visible one.
  var TTS_BLOCK_TAGS = { H1: 1, H2: 1, H3: 1, H4: 1, P: 1, DIV: 1, LI: 1, BLOCKQUOTE: 1, TR: 1 };
  function readableTextOf(el) {
    var out = [];
    (function walk(node) {
      if (node.nodeType === 3) { out.push(node.textContent); return; }
      if (node.nodeType !== 1) return;
      if (node.tagName === "BR") { out.push("\n"); return; }
      // Skip hidden DESCENDANTS — the un-chosen branch of the production-line
      // model answer — but never the element being read itself. Testing
      // `node.hidden` without the `node !== el` guard made this return empty
      // for any hidden root, which silently dropped every unopened hotspot
      // note from the printed notes even after the collector had allowed it
      // through.
      if (node !== el && node.hidden) return;
      Array.prototype.forEach.call(node.childNodes, walk);
      if (TTS_BLOCK_TAGS[node.tagName]) out.push("\n");
    })(el);
    // Join the block's lines with sentence punctuation, without adding a
    // second full stop to a line that already ends in one — a blanket
    // /\n+/ -> ". " replacement produces "...runs only once?." at every
    // block boundary, and a "\n \n" run yields a stray ". . ".
    var parts = out.join("").split("\n").map(function (s) {
      return s.replace(/[ \t]+/g, " ").trim();
    }).filter(Boolean);
    var text = "";
    parts.forEach(function (p) {
      if (!text) { text = p; return; }
      text += (/[.!?:;,]$/.test(text) ? " " : ". ") + p;
    });
    // Strips a block's own leading read-aloud button glyph, present once this
    // module has inserted one, so re-reading a block live never speaks or
    // prints the button itself.
    // (🔊|⏹) as ALTERNATION, not a [🔊⏹] character class — 🔊 is a surrogate
    // pair (outside the BMP), and a character class without the /u flag
    // matches individual UTF-16 code units, silently splitting it in half and
    // leaving a stray replacement character behind instead of stripping it.
    return text.replace(/^(🔊|⏹)\s*\.?\s*/, "").trim();
  }

  // Layout-independent existence check — used only to decide, at setup time
  // (while most sections are still display:none), which elements have real
  // content worth giving a button to.
  function hasReadableText(el) {
    return !!el.textContent.replace(/\s+/g, " ").trim();
  }

  // Every distinct readable chunk in a section, in document order, with
  // nested duplicates removed (a card's heading isn't returned separately
  // from the card's full text) and gated content excluded.
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

  // textFn is called AFTER stopSpeech() has reset any other speaking button
  // back to its idle label. The text is a lazy function, not a pre-computed
  // string, specifically so that reset happens first: reading it earlier can
  // pick up another button's live "⏹" glyph when that button sits inside the
  // content being read.
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
          // Recomputed live rather than cached from setup, so content
          // revealed since page load — an opened hotspot note, an earned
          // commit explanation, a completed classification row's verdict —
          // is picked up.
          return collectReadableBlocks(section)
            .filter(function (el) { return el.tagName !== "H2"; })
            .map(readableTextOf).join(". ");
        });
      });

      // One small per-block button each, so a student can replay a single
      // card or paragraph instead of the whole section. Decided at setup
      // time from what is collectible right now; anything still gated is
      // covered by the whole-page button's live recompute instead.
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
  // A printable record of everything the student answered, built generically
  // from this page's own DOM and localStorage (reusing each field's <label>,
  // each quiz's own question <p>, and the completion checks each exercise
  // already uses) rather than a hand-written per-question list, so it can't
  // drift out of sync with the questions. Uses the browser's native print
  // dialog (Save as PDF) — works everywhere, needs no library.
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
    // via readableTextOf, not raw textContent — that <p> may have a TTS
    // read-aloud button inserted as its first child, and a raw textContent
    // read would fold the button's glyph into the question stem.
    return p ? readableTextOf(p) : "Question";
  }

  // A stem already ending in its own punctuation gets an em-dash lead-in
  // rather than a colon, which would print as "...closed loop?: ".
  function stemLead(stem) {
    if (/[:;]$/.test(stem)) return escapeHtml(stem) + " ";
    return escapeHtml(stem) + (/[.!?]$/.test(stem) ? " — " : ": ");
  }

  function sectionSummaryItems(section) {
    var items = [];

    section.querySelectorAll("textarea[data-store], input[data-store]").forEach(function (el) {
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

    section.querySelectorAll(".choice-select[data-store]").forEach(function (block) {
      var stem = questionStemFor(block);
      var chosen = loadStore(block.getAttribute("data-store"));
      var btn = chosen ? block.querySelector('[data-value="' + chosen + '"]') : null;
      items.push(stemLead(stem) + (btn ? escapeHtml(readableTextOf(btn)) : '<span class="unanswered-tag">not chosen yet</span>'));
    });

    if (section.id === "sec-2") {
      items.push("Close-the-loop exercise: " +
        (loadStore("loop-blocks-done") ? '<span class="correct-tag">both blocks placed correctly</span>' : "not yet complete"));
    }

    if (section.id === "sec-7") {
      SYSTEMS.forEach(function (sys) {
        var v = loadStore("cls-" + sys.id + "-var");
        var a = loadStore("cls-" + sys.id + "-act");
        if (!v && !a) {
          items.push("<strong>" + escapeHtml(sys.name) + "</strong> — <span class=\"unanswered-tag\">not attempted</span>");
          return;
        }
        var correctVar = sys.options.filter(function (o) { return o.correct; })[0].text;
        var varOk = v === correctVar;
        var line = "<strong>" + escapeHtml(sys.name) + "</strong> — controlled variable: " +
          (v ? '"' + escapeHtml(v) + '" <span class="' + (varOk ? "correct-tag" : "incorrect-tag") + '">(' +
            (varOk ? "correct" : "the answer is “" + escapeHtml(correctVar) + "”") + ")</span>"
            : '<span class="unanswered-tag">not named</span>');
        if (a) {
          if (sys.act === "either") {
            line += "; verdict: " + (a === "yes" ? "closed loop" : "open loop") +
              ' <span class="correct-tag">(either answer is correct here — say which design or boundary you assumed)</span>';
          } else {
            var actOk = a === sys.act;
            line += "; verdict: " + (a === "yes" ? "closed loop" : "open loop") +
              ' <span class="' + (actOk ? "correct-tag" : "incorrect-tag") + '">(' +
              (actOk ? "correct" : "the answer is " + (sys.act === "yes" ? "closed loop" : "open loop")) + ")</span>";
          }
        } else {
          line += '; verdict: <span class="unanswered-tag">not answered</span>';
        }
        items.push(line);
      });
      var t = classificationTally();
      items.push("<strong>Total</strong> — controlled variables " + t.varsCorrect + "/" + t.total +
        " correct, verdicts " + t.verdictsCorrect + "/" + t.total + " correct.");
    }

    return items;
  }

  // Diagrams worth carrying into printed revision notes, keyed by section.
  // The close-the-loop diagram prints in whichever state the student left it
  // — blank if they haven't finished, completed if they have — rather than
  // handing over the finished answer through the print button.
  function summaryDiagramsFor(sid) {
    if (sid === "sec-2") {
      var closedSrc = (loadStore("single-ss-return") === "compare")
        ? "diagrams/closed-loop-answer.svg" : "diagrams/closed-loop-blank.svg";
      return [
        '<img class="summary-diagram" src="diagrams/open-loop-block.svg" alt="Open loop block diagram: setpoint, controller, actuator, output, with no return path.">',
        '<img class="summary-diagram" src="' + closedSrc + '" alt="Closed loop block diagram.">'
      ];
    }
    if (sid === "sec-9") {
      return ['<img class="summary-diagram" src="diagrams/arm-three-loops.svg" alt="The MeArm analysed as three simultaneous loops.">'];
    }
    if (sid === "sec-ext") {
      return ['<img class="summary-diagram" src="diagrams/stability-hunting.svg" alt="A well tuned closed loop settling on the setpoint, against a badly tuned one that keeps oscillating.">'];
    }
    return [];
  }

  function renderWorkSummaryHtml(name) {
    var html = "<h4>" + escapeHtml(name || "(name not entered)") + "</h4>";
    html += '<p class="summary-meta">Programming Mechatronics · Lesson 10 — Open and Closed Loop Control · ' +
      new Date().toLocaleDateString("en-AU") + ". Each section shows the lesson notes, then what you answered.</p>";
    SECTION_IDS.forEach(function (sid, i) {
      var section = document.getElementById(sid);
      if (!section) return;
      // data-summary-skip marks on-screen-only mechanics ("Drag each chip
      // into the box it belongs in", "the explanation only appears after you
      // commit") — still shown on the page and still read aloud, but there
      // is nothing to drag or click on a printout.
      // Question stems inside a quiz or commit block are dropped from the
      // notes because they come back verbatim under "Your answers" with the
      // student's own choice attached; printing them twice, once with no
      // answer beside it, just pads the notes.
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
    buildLoopExercise();   // registers its select listener before wireSingleSelects runs
    buildNav();

    wireTextInputs();
    wireRevealButtons();
    wireSingleSelects();
    wireChoiceSelects();
    wireHotspots();
    wireNextButtons();
    wireReset();
    wireWorkSummary();

    buildTextToSpeech();   // last, so it sees every generated block

    var last = loadStore("current-section") || "sec-1";
    if (SECTION_IDS.indexOf(last) === -1) last = "sec-1";
    goToSection(last);
  });
})();
