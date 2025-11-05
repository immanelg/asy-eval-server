import "./styles.css";
import { init, classModule, propsModule, styleModule, eventListenersModule, h, type VNode, fragment } from "snabbdom";

const env = import.meta.env;

type EvalStatus = null | "loading" | "ok" | "err" | "network-err";

type InputType = "asy" | "tex";
type OutputType = "svg" | "png";

type State = {
    code: string;

    inputType: InputType;

    outputType: OutputType;
    svgText: string | null;
    pngUrl: string | null;
    pngBlob: Blob | null;

    status: EvalStatus;
    errorMessage: null | string;

    doAutoEval: boolean;

    copyClicked: boolean;
    saveClicked: boolean;
};

const run = async () => {
    const state: State = {
        code: "",

        inputType: "asy",

        outputType: "svg",

        svgText: "",
        pngUrl: "",
        pngBlob: null,

        status: null,
        errorMessage: null,

        doAutoEval: true,

        copyClicked: false,
        saveClicked: false,
    };

    const renderOutput = () => {
        const { svgText, pngUrl, outputType } = state;
        switch (outputType) {
            case "svg":
                return h("div", { props: { innerHTML: svgText } });
            case "png":
                return h("img", {
                    props: {
                        src: pngUrl,
                    },
                    // style: { maxWidth: "100%", height: "auto" },
                });
        }
    };

    const render = (): VNode => {
        const { code, outputType, status, errorMessage, 
            copyClicked, saveClicked, doAutoEval } = state;

        const outputTypeChoice = (type: OutputType): VNode =>
            h("label.btn.typeswitch", {}, [
                h("input", {
                    props: {
                        type: "radio",
                        name: "outputType",
                        checked: outputType === type,
                    },
                    on: { change: onOuputTypeChange(type) },
                }),
                h("span", {}, type.toUpperCase()),
            ]);

        return h("div", {}, [
            h("h1", {}, "Asymptote Evaluator"),

            h("a", { props: { href: "https://github.com/immanelg/asy-eval-server" } }, "Star me on GitHub ⭐"),

            h("textarea#editor", {
                props: {
                    id: "editor",
                    value: code,
                },
                class: { [status as string]: true },
                on: {
                    input: onEditorInput,
                    keydown: onHotkey,
                    focus: e => {
                        scrollToElement(e.target);
                    },
                },
            }),

            h("div#eval-panel", {}, [
                h("button#send-eval.btn", {
                    props: {
                        disabled: code.trim() === "" || status === "loading",
                    },
                    on: {
                        click: sendEval,
                    },
                }, status === "loading" ? "Evaluating..." : "Evaluate"),
                outputTypeChoice("svg"),
                outputTypeChoice("png"),
                h("label.btn.autoEval", {}, [
                    h("input", {
                        props: {
                            type: "checkbox",
                            name: "autoEval",
                            checked: doAutoEval,
                        },
                        on: { change: toggleAutoEval },
                    }),
                    h("span", {}, "Auto-eval"),
                ]),
                h("button#start-demo.btn", { on: { click: startDemo } }, "Demo!"),

            ]),

            ...(status === "network-err" ? [ h("pre#network-err", {}, state.errorMessage) ] : []),
            ...(status === "err" ? [
                  h("p", {}, "Compiler errors:"),
                  h("pre#compiler-error", {
                          /* on: {
                              click: e => {
                                  const selection = window.getSelection();
                                  const range = docOneument.createRange();
                                  range.selectNodeContents(e.target);
                                  selection.removeAllRanges();
                                  selection.addRange(range);
                              },
                          }, */
                      }, errorMessage),
                  h("p", {}, [
                    "You are really bad at this, aren't you? Can you even draw a square? Here's some random tutorial: ",
                    h("a", { props: { href: "https://asymptote.sourceforge.io/asymptote_tutorial.pdf" } }, "Tutorial."),
                ]),
            ] : []),

            // the syntax iS REALLY ugly and annoying now.....
            ...(status == "ok" ? [h("div#output", {}, [
                    renderOutput(),
                    ...(status === "ok" ? [
                        h("div.#share-panel", {}, [
                            h( "button.btn.share", { on: { click: downloadOutput        } }, saveClicked ? "Saved!" : "Save"),
                            h( "button.btn.share", { on: { click: copyOutputToClipboard } }, copyClicked ? "Copied!" : "Copy"),
                        ])
                    ] : []),
                ]),
            ] : []),
        ]);
    };

    const scrollToElement = (el) => {
        if (typeof el === "string") el = document.querySelector(el)!;
        el.scrollIntoView({
            behavior: "smooth",
            block: "center",
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
        scrollToElement("#editor");

        cancelAutoEval();
        demoTimer = setTimeout(() => {
            demoCodeIdx = 0;
            state.code = "";
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
            default:
                throw new Error("invalid type " + outputType);
        }
    };

    const onEditorInput = e => {
        if (demoTimer !== null) return; // lock input
        state.code = e.target.value;
        if (state.doAutoEval) debounceAutoEval();
        redraw();
    };

    const toggleAutoEval = e => {
        if (state.doAutoEval) cancelAutoEval();
        else debounceAutoEval();
        state.doAutoEval = !state.doAutoEval;
        redraw();
    };

    const onHotkey = e => {
        if (e.ctrlKey && e.key === "Enter" && state.code.trim() !== "") sendEval();
        else if (e.key == "Escape") e.target.blur();
    };

    const onOuputTypeChange = outputType => () => {
        state.outputType = outputType;
        if (state.outputType === "png" && state.pngUrl) {
            URL.revokeObjectURL(state.pngUrl);
            state.pngUrl = null;
        }
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
        } catch (exception) {
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
        if (response.headers.get("Content-Type") === "text/vnd.asy-compiler-error") {
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
        if (state.status === "ok") scrollToElement("#output");
        else if (state.status === "err") scrollToElement("#compiler-error");
    };

    const downloadOutput = () => {
        state.saveClicked = true;
        redraw();
        const { outputType, svgText, pngBlob } = state;

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
        switch (outputType) {
            case "svg":
                downloadFromBlob(new Blob([svgText!], { type: "image/svg+xml" }), "asy.svg");
                break;
            case "png":
                downloadFromBlob(pngBlob!, "asy.png");
                break;
        }
    };

    const copyOutputToClipboard = () => {
        state.copyClicked = true;
        redraw();
        const { svgText, outputType, pngBlob } = state;

        switch (outputType) {
            case "svg":
                navigator.clipboard.writeText(svgText);
                return;
            case "png":
                if (navigator.clipboard && navigator.clipboard.write) {
                    const clipboardItem = new ClipboardItem({
                        [contentType()]: pngBlob,
                    });
                    navigator.clipboard.write([clipboardItem]);
                } else {
                    alert("Your browser sucks");
                }
                return;
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

    let debounceEvalTimer: TimerJob | null;
    const debounceEvalTimeoutMs = 2 * 1000;
    const cancelAutoEval = () => {
        if (debounceEvalTimer !== null) {
            clearTimeout(debounceEvalTimer);
            debounceEvalTimer = null;
        }
    };
    const debounceAutoEval = () => {
        cancelAutoEval();

        debounceEvalTimer = setTimeout(() => {
            sendEval();
        }, debounceEvalTimeoutMs);
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
            if (state.doAutoEval) debounceAutoEval();
            redraw();
        }
    });

    const patch = init([classModule, propsModule, styleModule, eventListenersModule]);

    let vnode: VNode = undefined;

    const redraw = () => {
        if (env.DEV) console.debug("redraw", state);
        vnode = patch(vnode || document.getElementById("app"), render());
    };

    // window.addEventListener('resize', () => redraw());

    redraw();

    if (state.doAutoEval) debounceAutoEval();
    startAutosave();

    // const textarea = document.getElementById('editor');
    // if (textarea) textarea.focus();
};

run();
