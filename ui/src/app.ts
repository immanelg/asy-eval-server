import "./styles.css";
import * as icon from "./icons.ts";
import { init, classModule, propsModule, styleModule, eventListenersModule, type VNode, fragment } from "snabbdom";
import { h } from "./h.ts";

const env = import.meta.env;

type EvalStatus = null | "loading" | "ok" | "err" | "network-err";

type InputType = "asy" | "tex";
type OutputType = "svg" | "png" | "pdf";

type State = {
    code: string;

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
};

const renderOutput = () => {
    switch (state.outputType) {
    case "svg": return h("div#output-impl", { props: { innerHTML: state.svgText } });
    case "png": return h("img#output-impl", { props: { src: state.pngUrl } });
    case "pdf": return h("embed#output-impl", { style: {"min-height": "1150px"}, props: { src: state.pdfUrl, type: "application/pdf" } });
    }
};

const render = (): VNode => {
    const { code, status, errorMessage, 
        copyClicked, saveClicked, doAutoEval } = state;

    // const outputTypeChoice = (type: OutputType): VNode =>
    //     h("label.btn.typeswitch", {}, [
    //         h("input", {
    //             props: {
    //                 type: "radio",
    //                 name: "outputType",
    //                 checked: outputType === type,
    //             },
    //             on: { change: onOuputTypeChange(type) },
    //         }),
    //         h("span", {}, type.toUpperCase()),
    //     ]);
                    
    return h("div", [
        h("h1", {}, "Asymptote Evaluator"),

        h("a", { props: { href: "https://github.com/immanelg/asy-eval-server" } }, "View the source on GitHub ⭐"),

        // h("div.numbered-wrapper", {}, [
        //     h("div.linenumbers", {}, 
        //         Array.from({ length: lines }, (_, i) => 

        //             h("div.line-number", { key: i }, i + 1)
        //         )
        //     ),
        //     h("textarea#editor", {
        //         props: {
        //             id: "editor",
        //             value: code,
        //         },
        //         class: { [status as string]: true },
        //         on: {
        //             input: onEditorInput,
        //             keydown: onHotkey,
        //             focus: e => scrollToElement(e.target),
        //         },
        //     }),
        // ]),
        h("textarea#editor", {
            props: {
                id: "editor",
                value: code,
                readonly: demoTimer !== null,
            },
            class: { [status as string]: true },
            on: {
                input: onEditorChange,
                keydown: onHotkey,
                click: e => scroll(e.target),
            },
        }),

        h("div#eval-panel", [
            h("button#send-eval.btn", {
                props: { disabled: code.trim() === "" || status === "loading" },
                on: { click: sendEval },
            }, status === "loading" && "Evaluating..." || [icon.render(icon.Run), "Evaluate"]),

            h("div.btn.typeswitch", [
                icon.render(icon.Read),
                // h("div.menu", 

                    [
                    h("div.menu-selected", h("span", state.outputType.toUpperCase())),
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
                    h("div.menu-selected", displayInputType(state.inputType)),
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

        status === "network-err" && h("pre#network-err", state.errorMessage),
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
                h("a", { props: { href: "https://asymptote.sourceforge.io/asymptote_tutorial.pdf" } }, "Tutorial."),
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
const displayInputType = (name: InputType) => { switch (name) { case "tex": return "LaTeX"; case "asy": return "Asymptote"} }

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
    scroll("#editor");

    cancelAutoEval();
    demoTimer = setTimeout(() => {
        demoCodeIdx = 0;
        state.code = "";
        state.inputType = "asy";
        state.outputType = "svg";
        redraw();
        const next = () => {
            if (demoCodeIdx < demoCode.length) {
                state.code += demoCode[demoCodeIdx];
                redraw();
                demoCodeIdx++;
                const delay = 20;
                demoTimer = setTimeout(next, delay);
            } else {
                demoTimer = null;
                (document.querySelector("#send-eval") as HTMLButtonElement).click();
            }
        };
        next();
    }, 0);
};

const contentType = () => {
    const { outputType } = state;
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

const onEditorChange = e => {
    state.code = e.target.value;
    if (state.doAutoEval) startAutoEval();
    redraw();
};

const toggleAutoEval = e => {
    if (state.doAutoEval) cancelAutoEval();
    else startAutoEval();
    state.doAutoEval = !state.doAutoEval;
    localStorage.setItem("doAutoEval", state.doAutoEval);
    redraw();
};

const onHotkey = (e: KeyboardEvent) => {
    const el = e.target as HTMLTextAreaElement;
    if (e.ctrlKey && e.key === "Enter" && state.code.trim() !== "") sendEval();
    // TODO: indent on Enter
    else if (e.key == "Escape") el.blur();
    else if (e.key == 'Tab') {
        e.preventDefault();
        const start = el.selectionStart;
        const end = el.selectionEnd;

        el.value = el.value.substring(0, start) + "\t" + el.value.substring(end);

        el.selectionStart = el.selectionEnd = start + 1;
    }
};

const onOuputTypeChange = (outputType: OutputType) => {
    state.outputType = outputType;
    if (state.outputType === "png") {
        state.pngUrl && URL.revokeObjectURL(state.pngUrl);
        state.pngUrl = null;
    } else if (state.outputType === "pdf" && state.pngUrl) {
        state.pdfUrl && URL.revokeObjectURL(state.pdfUrl);
        state.pdfUrl = null;
    }
    localStorage.setItem("outputType", state.outputType);
    sendEval();
};
const onInputTypeChange = (inputType: InputType) => {
    state.inputType = inputType;
    localStorage.setItem("inputType", state.inputType);
    
    sendEval();
};

const doEvalRequest = async () => {
    const { inputType, outputType } = state;
    let response;
    try {
        response = await fetch(`/api/eval?i=${inputType}&o=${outputType}`, {
            method: "POST",
            headers: {
                // Accept: contentType(),
            },
            body: state.code,
        });
    } catch (exc) {
        state.status = "network-err";
        state.errorMessage = `I caught an exception while performing an HTTP request.\n${exc}`;
        return;
    }
    if (!response.ok) {
        state.status = "network-err";
        state.errorMessage = `HTTP request returned an error response. Status: ${response.status} ${await response.text() ?? ""}`;
        return;
    }

    const blob = await response.blob();
    if (response.headers.get("Content-Type") === "application/vnd.asy-compiler-error") {
        state.status = "err";
        state.errorMessage = await blob.text();
        return;
    }

    state.status = "ok";
    switch (outputType) {
        case "svg":
            const svgText = await blob.text();
            state.svgText = svgText;
            break;
        case "png":
            const pngUrl = URL.createObjectURL(blob);
            state.pngUrl = pngUrl;
            state.pngBlob = blob;
            break;
        case "pdf":
            const pdfUrl = URL.createObjectURL(blob);
            state.pdfUrl = pdfUrl;
            state.pdfBlob = blob;
            break;
    }
};
const sendEval = async () => {
    if (state.code.trim() === "") return;

    cancelAutoEval();

    state.status = "loading" as EvalStatus;
    state.errorMessage = null;
    redraw();

    await doEvalRequest();
    redraw();
    if (state.status === "ok") setTimeout(() => scroll("#output"), 30);
    else if (state.status === "err") scroll("#compiler-error");
};

const downloadOutput = () => {
    state.saveClicked = true;
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
    switch (state.outputType) {
        case "svg":
            downloadFromBlob(new Blob([state.svgText!], { type: contentType() }), "asy.svg");
            break;
        case "png":
            downloadFromBlob(state.pngBlob!, "asy.png");
            break;
        case "pdf":
            downloadFromBlob(state.pdfBlob!, "asy.pdf"); 
            break;
    }
};

const copyOutputToClipboard = async () => {
    state.copyClicked = true;
    redraw();
    const { svgText, outputType, pngBlob, pdfBlob } = state;

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
    window.location.hash = encodeURIComponent(state.code);
};
const saveLocalStorage = () => {
    localStorage.setItem("code", state.code);
};

const loadFromHash = () => {
    const hash = window.location.hash.substring(1);
    if (!hash) return "";
    const code = decodeURIComponent(hash);
    return code;
};
const loadFromLocalStorage = () => localStorage.getItem("code") || "";

// initialize ...

const state: State = {
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
};

const code = loadFromHash();
if (code !== "") {
    state.code = decodeURIComponent(code);
    saveLocalStorage();
} else {
    const code = loadFromLocalStorage();
    if (code !== "") {
        state.code = code;
        saveHash();
    }
}
window.addEventListener("hashchange", () => {
    const code = loadFromHash();
    if (state.code !== code) {
        state.code = code;
        if (state.doAutoEval) startAutoEval();
        redraw();
    }
});

const patch = init([classModule, propsModule, styleModule, eventListenersModule]);

let vnode: VNode | null = null;

const redraw = () => {
    if (env.DEV) console.count("redraw");
    vnode = patch(vnode || document.getElementById("app")!, render());
};

// window.addEventListener('resize', () => redraw());

redraw();

if (state.doAutoEval) startAutoEval();
startAutosave();

// const textarea = document.getElementById('editor');
// if (textarea) textarea.focus();
