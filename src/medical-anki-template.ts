export const MEDICAL_ANKI_TEMPLATE_NAME = 'Cloze'

export const MEDICAL_ANKI_FRONT_TEMPLATE = String.raw`<div id="obsidian-card" class="card-shell">
    <div id="text" class="main-text">
        {{cloze:Text}}
    </div>
</div>

<script>
(function () {
    function renderBoldMarkdown(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];

        while (walker.nextNode()) {
            nodes.push(walker.currentNode);
        }

        nodes.forEach(function (node) {
            const text = node.nodeValue || "";
            if (!text.includes("**")) {
                return;
            }

            const fragment = document.createDocumentFragment();
            const parts = text.split(/(\*\*[^*]+\*\*)/g);

            parts.forEach(function (part) {
                if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
                    const strong = document.createElement("strong");
                    strong.textContent = part.slice(2, -2);
                    fragment.appendChild(strong);
                } else if (part.length > 0) {
                    fragment.appendChild(document.createTextNode(part));
                }
            });

            node.parentNode.replaceChild(fragment, node);
        });
    }

    const disabledValues = ["off", "false", "0", "nein", "normal"];
    const setting = ` + '`{{text:One by one}}`' + String.raw`.trim().toLowerCase();

    const textContainer = document.getElementById("text");
    if (textContainer) {
        renderBoldMarkdown(textContainer);
    }

    if (disabledValues.includes(setting)) {
        return;
    }

    const clozes = document.querySelectorAll("#text .cloze");
    if (clozes.length < 2) {
        return;
    }

    const card = document.getElementById("obsidian-card");
    if (card) {
        card.style.visibility = "hidden";
    }

    function autoFlip() {
        if (window.pycmd) {
            pycmd("ans");
            return;
        }

        if (window.showAnswer) {
            showAnswer();
            return;
        }

        if (card) {
            card.style.visibility = "visible";
        }
    }

    setTimeout(autoFlip, 30);
})();
</script>`

export const MEDICAL_ANKI_BACK_TEMPLATE = String.raw`<div class="card-shell">
    <div id="text" class="main-text">
        {{cloze:Text}}
    </div>

    <div id="onebyone-controls" class="onebyone-controls" style="display:none;">
        <button class="reveal-button" onclick="revealNextCloze(); event.stopPropagation();">
            Next point <span class="shortcut">N</span>
        </button>
        <button class="reveal-button secondary" onclick="revealAllClozes(); event.stopPropagation();">
            Show all
        </button>
    </div>

    <div id="after-answer">
        {{#Back Extra}}
        <div class="back-extra">
            {{Back Extra}}
        </div>
        {{/Back Extra}}

        <div class="extra-panels">
            {{#Eigene Prüfungsfragen}}
            <div id="field-questions" class="extra-field question-field">
                <div class="field-title">Prüfungsfragen</div>
                <div class="field-content">{{Eigene Prüfungsfragen}}</div>
            </div>
            {{/Eigene Prüfungsfragen}}

            {{#Definitionen}}
            <div id="field-definitions" class="extra-field definition-field">
                <div class="field-title">Definition</div>
                <div class="field-content">{{Definitionen}}</div>
            </div>
            {{/Definitionen}}

            {{#Mechanismus}}
            <div id="field-mechanism" class="extra-field mechanism-field">
                <div class="field-title">Mechanismus</div>
                <div class="field-content">{{Mechanismus}}</div>
            </div>
            {{/Mechanismus}}

            {{#Klinik}}
            <div id="field-clinic" class="extra-field clinic-field">
                <div class="field-title">Klinik</div>
                <div class="field-content">{{Klinik}}</div>
            </div>
            {{/Klinik}}

            {{#Dosis}}
            <div id="field-dose" class="extra-field dose-field">
                <div class="field-title">Dosis</div>
                <div class="field-content">{{Dosis}}</div>
            </div>
            {{/Dosis}}

            {{#Cave}}
            <div id="field-cave" class="extra-field cave-field">
                <div class="field-title">Cave / Prüfungsfalle</div>
                <div class="field-content">{{Cave}}</div>
            </div>
            {{/Cave}}

            {{#Merksprüche}}
            <div id="field-mnemonics" class="extra-field mnemonic-field">
                <div class="field-title">Merkspruch</div>
                <div class="field-content">{{Merksprüche}}</div>
            </div>
            {{/Merksprüche}}
        </div>

        <div class="field-buttons">
            {{#Eigene Prüfungsfragen}}
            <button class="field-button question-button" data-panel="field-questions" onclick="toggleField('field-questions'); event.stopPropagation();">Prüfungsfragen</button>
            {{/Eigene Prüfungsfragen}}

            {{#Definitionen}}
            <button class="field-button definition-button" data-panel="field-definitions" onclick="toggleField('field-definitions'); event.stopPropagation();">Definition</button>
            {{/Definitionen}}

            {{#Mechanismus}}
            <button class="field-button mechanism-button" data-panel="field-mechanism" onclick="toggleField('field-mechanism'); event.stopPropagation();">Mechanismus</button>
            {{/Mechanismus}}

            {{#Klinik}}
            <button class="field-button clinic-button" data-panel="field-clinic" onclick="toggleField('field-clinic'); event.stopPropagation();">Klinik</button>
            {{/Klinik}}

            {{#Dosis}}
            <button class="field-button dose-button" data-panel="field-dose" onclick="toggleField('field-dose'); event.stopPropagation();">Dosis</button>
            {{/Dosis}}

            {{#Cave}}
            <button class="field-button cave-button" data-panel="field-cave" onclick="toggleField('field-cave'); event.stopPropagation();">Cave</button>
            {{/Cave}}

            {{#Merksprüche}}
            <button class="field-button mnemonic-button" data-panel="field-mnemonics" onclick="toggleField('field-mnemonics'); event.stopPropagation();">Merkspruch</button>
            {{/Merksprüche}}
        </div>

        {{#Tags}}
        <div class="tags">
            {{Tags}}
        </div>
        {{/Tags}}
    </div>
</div>

<script>
(function () {
    function renderBoldMarkdown(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];

        while (walker.nextNode()) {
            nodes.push(walker.currentNode);
        }

        nodes.forEach(function (node) {
            const text = node.nodeValue || "";
            if (!text.includes("**")) {
                return;
            }

            const fragment = document.createDocumentFragment();
            const parts = text.split(/(\*\*[^*]+\*\*)/g);

            parts.forEach(function (part) {
                if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
                    const strong = document.createElement("strong");
                    strong.textContent = part.slice(2, -2);
                    fragment.appendChild(strong);
                } else if (part.length > 0) {
                    fragment.appendChild(document.createTextNode(part));
                }
            });

            node.parentNode.replaceChild(fragment, node);
        });
    }

    const disabledValues = ["off", "false", "0", "nein", "normal"];
    const oneByOneSetting = ` + '`{{text:One by one}}`' + String.raw`.trim().toLowerCase();

    const textContainer = document.getElementById("text");
    const controls = document.getElementById("onebyone-controls");
    const afterAnswer = document.getElementById("after-answer");

    if (!textContainer) {
        return;
    }

    renderBoldMarkdown(document.querySelector(".card-shell"));

    function getPanels() {
        return Array.from(document.querySelectorAll(".extra-field"));
    }

    function getVisiblePanels() {
        return getPanels().filter(function (panel) {
            return panel.classList.contains("field-visible");
        });
    }

    window.toggleField = function (id) {
        const field = document.getElementById(id);
        if (!field) {
            return;
        }

        field.classList.toggle("field-visible");
    };

    window.showNextExtraPanel = function () {
        const panels = getPanels();
        if (panels.length === 0) {
            return;
        }

        const visiblePanels = getVisiblePanels();
        if (visiblePanels.length >= panels.length) {
            panels.forEach(function (panel) {
                panel.classList.remove("field-visible");
            });
            return;
        }

        panels[visiblePanels.length].classList.add("field-visible");
    };

    function initOneByOne() {
        const clozes = Array.from(textContainer.querySelectorAll(".cloze"));
        const enabled = clozes.length >= 2 && !disabledValues.includes(oneByOneSetting);

        if (!enabled) {
            return;
        }

        const answers = clozes.map(function (cloze) {
            return cloze.innerHTML;
        });

        let nextIndex = 0;

        clozes.forEach(function (cloze) {
            cloze.innerHTML = "[...]";
            cloze.classList.add("cloze-pending");
        });

        if (controls) {
            controls.style.display = "flex";
        }

        if (afterAnswer) {
            afterAnswer.style.display = "none";
        }

        window.revealNextCloze = function () {
            if (nextIndex >= clozes.length) {
                return;
            }

            clozes[nextIndex].innerHTML = answers[nextIndex];
            clozes[nextIndex].classList.remove("cloze-pending");
            nextIndex += 1;

            if (nextIndex >= clozes.length) {
                if (controls) {
                    controls.style.display = "none";
                }

                if (afterAnswer) {
                    afterAnswer.style.display = "block";
                }
            }
        };

        window.revealAllClozes = function () {
            clozes.forEach(function (cloze, index) {
                cloze.innerHTML = answers[index];
                cloze.classList.remove("cloze-pending");
            });

            nextIndex = clozes.length;

            if (controls) {
                controls.style.display = "none";
            }

            if (afterAnswer) {
                afterAnswer.style.display = "block";
            }
        };
    }

    if (typeof window.revealNextCloze !== "function") {
        window.revealNextCloze = function () {};
    }

    if (typeof window.revealAllClozes !== "function") {
        window.revealAllClozes = function () {};
    }

    initOneByOne();

    document.addEventListener(
        "keydown",
        function (event) {
            const key = event.key.toLowerCase();

            if (key === "n" && !event.ctrlKey && !event.altKey && !event.metaKey) {
                event.preventDefault();
                event.stopPropagation();
                window.revealNextCloze();
                return;
            }

            if (key === "," && !event.ctrlKey && !event.altKey && !event.metaKey) {
                event.preventDefault();
                event.stopPropagation();
                window.revealAllClozes();
                return;
            }

            if (key === "x" && !event.ctrlKey && !event.altKey && !event.metaKey) {
                event.preventDefault();
                event.stopPropagation();
                window.showNextExtraPanel();
            }
        },
        true
    );
})();
</script>`

export const MEDICAL_ANKI_STYLING = String.raw`:root {
    --bg: #f7f7f7;
    --text: #29292d;
    --bg-dark: #2f2f31;
    --text-dark: #e9e9e9;
    --cloze: #e4564a;
    --cloze-dark: #ed7770;
    --bold: #50a14f;
    --extra-bg: rgba(120, 120, 120, 0.08);
    --border: rgba(120, 120, 120, 0.25);
    --question: #d65c62;
    --definition: #7d8f9f;
    --mechanism: #b978d4;
    --clinic: #2e936d;
    --dose: #df8619;
    --cave: #d9534f;
    --mnemonic: #4172b8;
    --button-bg: rgba(120, 120, 120, 0.08);
    --button-hover: rgba(120, 120, 120, 0.18);
    --max-width: 900px;
}

.card {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif !important;
    font-size: 22px;
    line-height: 1.5;
    color: var(--text);
    background: var(--bg);
    text-align: left;
    margin: 0;
    padding: 22px;
}

.nightMode.card,
.night_mode .card {
    color: var(--text-dark);
    background: var(--bg-dark);
}

.card-shell {
    width: 100%;
    max-width: var(--max-width);
    margin: 0 auto;
    box-sizing: border-box;
}

.main-text,
.main-text *,
.back-extra,
.back-extra *,
.extra-field,
.extra-field *,
.field-content,
.field-content *,
.field-title,
.field-button,
.reveal-button,
.tags {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif !important;
}

.main-text {
    width: 100%;
    font-size: 1em;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    box-sizing: border-box;
}

b,
strong {
    color: var(--bold);
}

.cloze {
    color: var(--cloze) !important;
    font-weight: 700;
}

.nightMode .cloze,
.night_mode .cloze {
    color: var(--cloze-dark) !important;
}

.cloze-pending {
    color: var(--cloze) !important;
    font-weight: 700;
}

.back-extra {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-top: 24px;
    padding: 15px 17px;
    border-left: 4px solid #909090;
    border-radius: 6px;
    background: var(--extra-bg);
    font-size: 18px;
    line-height: 1.5;
    overflow-wrap: anywhere;
}

.onebyone-controls {
    width: 100%;
    box-sizing: border-box;
    margin-top: 22px;
    gap: 9px;
    flex-wrap: wrap;
}

.shortcut {
    display: inline-block;
    margin-left: 5px;
    padding: 1px 5px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 11px;
    opacity: 0.65;
}

.reveal-button,
.field-button {
    appearance: none;
    -webkit-appearance: none;
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 7px 11px;
    font-size: 13px;
    line-height: 1.2;
    cursor: pointer;
    color: inherit;
    background: var(--button-bg);
    box-shadow: none;
}

.reveal-button:hover,
.field-button:hover {
    background: var(--button-hover);
}

.secondary {
    opacity: 0.7;
}

.extra-panels {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-top: 16px;
}

.extra-field {
    display: none;
    width: 100%;
    box-sizing: border-box;
    margin-top: 12px;
    padding: 14px 16px;
    border-radius: 6px;
    background: var(--extra-bg);
    font-size: 18px;
    line-height: 1.5;
    overflow-wrap: anywhere;
}

.extra-field.field-visible {
    display: block;
}

.field-title {
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.65;
}

.field-content {
    width: 100%;
    box-sizing: border-box;
    overflow-wrap: anywhere;
}

.question-field { border-left: 4px solid var(--question); }
.definition-field { border-left: 4px solid var(--definition); }
.mechanism-field { border-left: 4px solid var(--mechanism); }
.clinic-field { border-left: 4px solid var(--clinic); }
.dose-field { border-left: 4px solid var(--dose); }
.cave-field { border-left: 4px solid var(--cave); }
.mnemonic-field { border-left: 4px solid var(--mnemonic); }

.field-buttons {
    display: flex;
    width: 100%;
    box-sizing: border-box;
    margin-top: 18px;
    gap: 7px;
    flex-wrap: wrap;
}

.question-button { border-color: var(--question); }
.definition-button { border-color: var(--definition); }
.mechanism-button { border-color: var(--mechanism); }
.clinic-button { border-color: var(--clinic); }
.dose-button { border-color: var(--dose); }
.cave-button { border-color: var(--cave); }
.mnemonic-button { border-color: var(--mnemonic); }

.tags {
    margin-top: 22px;
    font-size: 11px;
    opacity: 0.35;
    text-align: center;
}

ul,
ol {
    margin-top: 7px;
    margin-bottom: 7px;
    padding-left: 1.5em;
}

li {
    margin-top: 2px;
    margin-bottom: 2px;
}

table {
    width: 100%;
    border-collapse: collapse;
    box-sizing: border-box;
}

td,
th {
    border: 1px solid var(--border);
    padding: 6px;
}

img {
    max-width: 100%;
    height: auto;
}

@media (max-width: 600px) {
    .card {
        font-size: 20px;
        padding: 14px;
    }

    .back-extra,
    .extra-field {
        font-size: 17px;
    }

    .field-button,
    .reveal-button {
        font-size: 12px;
    }
}`
