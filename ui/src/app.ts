import "./styles.css";
import * as icon from "./icons.ts";
import { init, classModule, propsModule, styleModule, attributesModule, eventListenersModule, type VNode, fragment } from "snabbdom";
import { h } from "./h.ts";
import { tokenize } from "./parser.ts";

const env = import.meta.env;

const API_URL = env.VITE_API_URL;
if (env.DEV) console.log("env:", JSON.stringify(env));

type EvalStatus = null | "loading" | "ok" | "err" | "network-err";

type InputType = "asy" | "tex";
type OutputType = "svg" | "png" | "pdf";


type State = {
    code: string;
    cursorPosition: number;

    inputType: InputType;

    outputType: OutputType;
    svgText: string | null;
    pngUrl: string | null;
    pngBlob: Blob | null;
    pdfUrl: string | null;
    pdfBlob: Blob | null;

    status: EvalStatus;
    errorMessage: null | string;

    doAutoEval: boolean;

    copyClicked: boolean;
    saveClicked: boolean;

    demoing: boolean;
};


const displayInputType = (name: InputType) => { switch (name) { case "tex": return "LaTeX"; case "asy": return "Asymptote"} }

const onEditorKeydown = e => {
    const { key, ctrlKey, metaKey } = e;

    if (e.ctrlKey && e.key === "Enter" && s.code.trim() !== "") { 
        sendEval();
        // event.preventDefault();
    } else if (key === 'Tab') {
        e.preventDefault();
        document.execCommand('insertText', false, '    ');
    } else if (key === 'Backspace') {
        // event.preventDefault();
    } else if (key == "Enter") {
        e.preventDefault()
          document.execCommand('insertLineBreak')
    }
};
const onEditorInput = e => {
    const changed = e.target.textContent || "";
    if (changed === s.code) return;  // input called second time after update() hook
    s.code = changed;
    if (s.doAutoEval) startAutoEval();
    redraw();
};
const numlines = () => {
    let n = 1;
    for (const c of s.code) if (c === "\n") n++;
    return n;
}

const scroll = (el: string | any) => {
    if (typeof el === "string") el = document.querySelector(el)!;
    (el as HTMLElement).scrollIntoView({
        behavior: "smooth",
        block: "start",
    });
}

type TimerJob = number;
let demoTimer: TimerJob | null = null;
let demoCodeIdx = 0;
const demoCode = `\
import three;
size(10cm, 0);
currentlight = light(diffuse = new pen[] {blue, green},
specular = new pen[] {black, white},
position = new triple[] {-Y+Z, X+Y});
draw(unitsphere, surfacepen=white);`;

const startDemo = () => {
    scroll(".editor");

    cancelAutoEval();
    demoTimer = setTimeout(() => {
        demoCodeIdx = 0;
        s.demoing = true;
        s.code = "";
        s.inputType = "asy";
        s.outputType = "svg";
        redraw();
        const next = () => {
            if (demoCodeIdx < demoCode.length) {
                s.code += demoCode[demoCodeIdx];
                redraw();
                demoCodeIdx++;
                const delay = 20;
                demoTimer = setTimeout(next, delay);
            } else {
                demoTimer = null;
                s.demoing = false;
                redraw();
                (document.querySelector("#send-eval") as HTMLButtonElement).click();
            }
        };
        next();
    }, 0);
};

const contentType = () => {
    const { outputType } = s;
    switch (outputType) {
        case "svg":
            return "image/svg+xml";
        case "png":
            return "image/png";
        case "pdf":
            return "application/pdf";
        default:
            throw new Error("invalid type " + outputType);
    }
};


const toggleAutoEval = e => {
    if (s.doAutoEval) cancelAutoEval();
    else startAutoEval();
    s.doAutoEval = !s.doAutoEval;
    localStorage.setItem("doAutoEval", s.doAutoEval);
    redraw();
};

const onOuputTypeChange = (outputType: OutputType) => {
    s.outputType = outputType;
    if (s.outputType === "png") {
        s.pngUrl && URL.revokeObjectURL(s.pngUrl);
        s.pngUrl = null;
    } else if (s.outputType === "pdf" && s.pngUrl) {
        s.pdfUrl && URL.revokeObjectURL(s.pdfUrl);
        s.pdfUrl = null;
    }
    localStorage.setItem("outputType", s.outputType);
    sendEval();
};
const onInputTypeChange = (inputType: InputType) => {
    s.inputType = inputType;
    localStorage.setItem("inputType", s.inputType);
    
    sendEval();
};

const doEvalRequest = async () => {
    const { inputType, outputType } = s;
    let response;
    try {
        response = await fetch(`${API_URL}/eval?i=${inputType}&o=${outputType}`, {
            method: "POST",
            headers: {
                // Accept: contentType(),
            },
            body: s.code,
        });
    } catch (exc) {
        s.status = "network-err";
        s.errorMessage = `I caught an exception while performing an HTTP request.\n${exc}`;
        return;
    }
    if (!response.ok) {
        s.status = "network-err";
        s.errorMessage = `HTTP request returned an error response. Status: ${response.status} ${await response.text() ?? ""}`;
        return;
    }

    const blob = await response.blob();
    if (response.headers.get("Content-Type") === "application/vnd.asy-compiler-error") {
        s.status = "err";
        s.errorMessage = await blob.text();
        return;
    }

    s.status = "ok";
    switch (outputType) {
        case "svg":
            const svgText = await blob.text();
            s.svgText = svgText;
            break;
        case "png":
            const pngUrl = URL.createObjectURL(blob);
            s.pngUrl = pngUrl;
            s.pngBlob = blob;
            break;
        case "pdf":
            const pdfUrl = URL.createObjectURL(blob);
            s.pdfUrl = pdfUrl;
            s.pdfBlob = blob;
            break;
    }
};
const sendEval = async () => {
    if (s.code.trim() === "") return;

    cancelAutoEval();

    s.status = "loading" as EvalStatus;
    s.errorMessage = null;
    redraw();

    await doEvalRequest();
    redraw();
    if (s.status === "ok") setTimeout(() => scroll("#output"), 30);
    else if (s.status === "err") scroll("#compiler-error");
};

const downloadOutput = () => {
    s.saveClicked = true;
    redraw();

    const downloadFromBlob = (blob: Blob, name: string): void => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    switch (s.outputType) {
        case "svg":
            downloadFromBlob(new Blob([s.svgText!], { type: contentType() }), "asy.svg");
            break;
        case "png":
            downloadFromBlob(s.pngBlob!, "asy.png");
            break;
        case "pdf":
            downloadFromBlob(s.pdfBlob!, "asy.pdf"); 
            break;
    }
};

const copyOutputToClipboard = async () => {
    s.copyClicked = true;
    redraw();
    const { svgText, outputType, pngBlob, pdfBlob } = s;

    try {
        switch (outputType) {
            case "svg":
                await navigator.clipboard.writeText(svgText!);
                break;
            case "png":
                navigator.clipboard.write([
                    new ClipboardItem(
                        { [contentType()]: pdfBlob! 
                    })
                ]);
                break;
            case "pdf":
                await navigator.clipboard.write([
                    new ClipboardItem(
                        { [contentType()]: pdfBlob! 
                    })
                ]);
                break;
        }
    } catch (e) {
        alert(e);
        throw e;
    }
};

let autosaveInterval: TimerJob | null = null;
const autosaveMs = 3 * 1000;
const cancelAutosave = () => {
    if (autosaveInterval !== null) {
        clearInterval(autosaveInterval);
        autosaveInterval = null;
    }
};
const startAutosave = () =>
    setInterval(() => {
        saveHash();
        saveLocalStorage();
    }, autosaveMs);

let autoEvalTimer: TimerJob | null;
const autoEvalDelay = 2 * 1000;
const cancelAutoEval = () => {
    if (autoEvalTimer !== null) {
        clearTimeout(autoEvalTimer);
        autoEvalTimer = null;
    }
};
const startAutoEval = () => {
    cancelAutoEval();

    autoEvalTimer = setTimeout(() => {
        sendEval();
    }, autoEvalDelay);
};

const saveHash = () => {
    window.location.hash = encodeURIComponent(s.code);
};
const saveLocalStorage = () => {
    localStorage.setItem("code", s.code);
};

const loadFromHash = () => {
    const hash = window.location.hash.substring(1);
    if (!hash) return "";
    const code = decodeURIComponent(hash);
    return code;
};
const loadFromLocalStorage = () => localStorage.getItem("code") || "";

const renderOutput = () => {
    switch (s.outputType) {
    case "svg": return h("div#output-impl", { props: { innerHTML: s.svgText } });
    case "png": return h("img#output-impl", { props: { src: s.pngUrl } });
    case "pdf": return h("embed#output-impl", { style: {"min-height": "1150px"}, props: { src: s.pdfUrl, type: "application/pdf" } });
    }
};

const syHighlight = (code: string) => 
    s.inputType === "asy" ?
        tokenize(code).map(token => h("span",  {attrs: {class: [`sy-${token.type}`] } }, token.value))
        : code;

const editorTextareaInput = e => {
    s.code = e.target.value;
    if (s.doAutoEval) startAutoEval();

    editorSyncScroll(e.target);
    redraw();
};

const onHotkey = (e: KeyboardEvent) => {
    const el = e.target as HTMLTextAreaElement;
    if (e.ctrlKey && e.key === "Enter" && s.code.trim() !== "") sendEval();
    else if (e.key == 'Enter') {
        //TODO: add indent
    }
    else if (e.key == "Escape") el.blur();
    else if (e.key == 'Tab') {
        e.preventDefault();
        document.execCommand('insertText', false, '    '); // muh deprecated need to updoot
        return;
        // // i have no idea why this is broken.
        // const start = el.selectionStart;
        // const end = el.selectionEnd;
        // const position = start + 4;
        // console.log("range:", start, end);

        // s.code = s.code.substring(0, start) + "    " + s.code.substring(end);
        // console.log("code1", s.code);

        // el.selectionStart = el.selectionEnd = position;
        // redraw();
        // console.log("code2", s.code);
    }
};

let editorContentRef = null;
let gutterRef = null;
const editorSyncScroll = (textarea) => {
    editorContentRef.scrollTop = textarea.scrollTop;
    editorContentRef.scrollLeft = textarea.scrollLeft ;
    gutterRef.scrollTop = textarea.scrollTop;
}
const gutter = () => {
    let length = s.code.split("").filter(c => c === "\n").length;
    length++; // current line
    length++; // eob
    return Array.from({length}, (_, i) => i < length-1 ? 
        h("div.editor-lnr", { key: i }, `${i+1}`)
        : h("div.editor-lnr.eob", { key: i }, `~`)
    );
}

const renderEditor = (): VNode => {
    return h("div.editor",

        h("div.editor-inner", [
            h("div.editor-gutter", {
                    hook: {
                        create: (_, vnode) => {
                            gutterRef = vnode.elm;
                        },
                    }
                },
                gutter(),
            ),
            h("textarea.editor-textarea", {
                props: {
                    value: code,
                },
                attrs: {
                    readonly: s.demoing,
                    spellcheck: "false",
                },
                class: { [s.status as string]: true },
                on: {
                    input: editorTextareaInput,
                    keydown: onHotkey,
                    click: e => scroll(e.target),
                    scroll: e => {
                        editorSyncScroll(e.target);
                    },
                },

            }, s.code),
            h("pre.editor-content", {
                hook: {
                    create: (_, vnode) => {
                        editorContentRef = vnode.elm;
                    },
                     //insert: vnode => {
                     //    vnode.elm.innerHTML = syHighlight(s.code);
                     //},
                     //update: (oldVnode: VNode, newVnode: VNode) => {
                     //    if (oldVnode.elm.textContent !== s.code) {
                     //        newVnode.elm.innerHTML = syHighlight(s.code);
                     //    }
                     //},
                },
            }, syHighlight(s.code)),
        ])
    )
}



const render = (): VNode => {
    const { code, status, errorMessage, 
        copyClicked, saveClicked, doAutoEval } = s;

    return h("div", [
        h("h1", {}, "Asymptote Evaluator"),

        h("a", { attrs: { href: "https://github.com/immanelg/asy-eval-server" } }, "View the source on GitHub ⭐"),

        renderEditor(),

        h("div#eval-panel", [
            h("button#send-eval.btn", {
                attrs: { disabled: code.trim() === "" || status === "loading" },
                on: { click: sendEval },
            }, status === "loading" && "Evaluating..." || [icon.render(icon.Run), "Evaluate"]),

            h("div.btn.typeswitch", [
                icon.render(icon.Read),
                // h("div.menu", 

                    [
                    h("div.menu-selected", h("span", s.outputType.toUpperCase())),
                    h("div.menu-options", 
                        ["svg", "png", "pdf"].map(name => 
                            h("div.menu-option", {
                                on: { click: () => onOuputTypeChange(name as OutputType) }
                            }, name.toUpperCase())
                        )
                    ),
                ]
                // ),
            ]),

            h("div.btn.typeswitch", [
                icon.render(icon.Write),
                //h("div.menu", 
                    [
                    h("div.menu-selected", displayInputType(s.inputType)),
                    h("div.menu-options", 
                        ["asy", "tex"].map(name => 
                            h("div.menu-option", {
                                on: { click: () => onInputTypeChange(name as InputType) }
                            }, displayInputType(name as InputType))
                        )
                    ),
                ]
               // ),
            ]),

            h("button.btn.autoEval", {
                class: { active: doAutoEval },
                on: { click: toggleAutoEval },
            }, [
                doAutoEval ? icon.render(icon.Watch) : icon.render(icon.Unwatch),
                "Auto-eval"
            ]),
            h("button#start-demo.btn", { on: { click: startDemo } }, [icon.render(icon.Gift), "Demo!"]),

        ]),

        status === "network-err" && h("pre#network-err", s.errorMessage),
        status === "err" && [
              h("p", "Compiler errors:"),
              h("pre#compiler-error", {
                      on: {
                          click: e => scroll(e.target),
                          /*click: e => {
                              const selection = window.getSelection();
                              const range = docOneument.createRange();
                              range.selectNodeContents(e.target);
                              selection.removeAllRanges();
                              selection.addRange(range);
                          },*/
                      },
                  }, errorMessage),
              h("p", [
                "You are really bad at this, aren't you? Can you even draw a square? Here's some random tutorial: ",
                h("a", { attrs: { href: "https://asymptote.sourceforge.io/asymptote_tutorial.pdf" } }, "Tutorial."),
            ]),
        ],

        status == "ok" && h("div#output", {on: {click: (e: any) => scroll(e.target)}}, [
            renderOutput(),
            h("div#share-panel", [
                h("button#save.btn", { class: {clicked: saveClicked}, on: { click: downloadOutput        } }, saveClicked && [icon.render(icon.Save), "Downloaded"] || [icon.render(icon.Save), "Download"]),
                h("button#copy.btn", { class: {clicked: copyClicked}, on: { click: copyOutputToClipboard } }, copyClicked && [icon.render(icon.Copied), "Copied"]     || [icon.render(icon.Copy), "Copy"]    ),
            ])
        ])
    ]);
};

// initialize ...

const s: State = {
    code: "",
    inputType: localStorage.getItem("inputType") as InputType | null ?? "asy",
    outputType: localStorage.getItem("outputType") as OutputType | null ?? "svg",

    svgText: null,
    pngUrl: null,
    pngBlob: null,
    pdfUrl: null,
    pdfBlob: null,

    status: null,
    errorMessage: null,

    doAutoEval: JSON.parse(localStorage.getItem("doAutoEval")) as boolean | null ?? true,

    copyClicked: false,
    saveClicked: false,
    demoing: false,
};

const code = loadFromHash();
if (code !== "") {
    s.code = decodeURIComponent(code);
    saveLocalStorage();
} else {
    const code = loadFromLocalStorage();
    if (code !== "") {
        s.code = code;
        saveHash();
    }
}
window.addEventListener("hashchange", () => {
    const code = loadFromHash();
    if (s.code !== code) {
        s.code = code;
        if (s.doAutoEval) startAutoEval();
        redraw();
    }
});

const patch = init([classModule, propsModule, attributesModule, styleModule, eventListenersModule]);

let vnode: VNode | null = null;

const redraw = () => {
    if (false && env.DEV) console.count("redraw");
    vnode = patch(vnode || document.getElementById("app")!, render());
};

// window.addEventListener('resize', () => redraw());

redraw();

if (s.doAutoEval) startAutoEval();
startAutosave();

// const textarea = document.getElementById('editor');
// if (textarea) textarea.focus();
