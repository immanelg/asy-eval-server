import "./styles.css";
import {
  init,
  classModule,
  propsModule,
  styleModule,
  eventListenersModule,
  h,
  type VNode
} from "snabbdom";

const API_SERVER = "http://localhost:8000";

const run = async () => {

    interface State {
        code: string;
        outputType: "svg" | "png";
        svgText: string | null;
        pngUrl: string | null;
        pngBlob: Blob | null;
        loadingOutput: boolean, 
        nothingEverHappened: boolean, 
        status: null | "ok" | "err",
        errmsg: null | string,
    }
    const state: State = {
        code: "",
        outputType: "svg",
        svgText: "",
        pngUrl: "",
        pngBlob: null,
        loadingOutput: false, 
        nothingEverHappened: true, 
        status: null,
        errmsg: null,
    };

    const render = () => {
        const { code, outputType, loadingOutput, nothingEverHappened, status, errmsg } = state;

        const outtypeInput = (type) =>
            h('label.btn.typeswitch', {}, [
                h('input', {
                    props: {
                        type: 'radio',
                        name: 'outputType',
                        checked: outputType === type
                    },
                    on: { change: onOuputChange(type) },
                }),
                h("span", {}, type.toUpperCase()),
            ])
        

        return h('div', {}, [
            h('h1', {}, 'Asymptote Evaluator'),

            h('a', {
                props: {
                    href: 'https://github.com/immanelg/asy-eval-server',
                }
            }, 'Star me on GitHub ⭐'),

            h('textarea#editor', {
                props: {
                    id: 'editor',
                    value: code
                },
                class: { [status]: true },
                on: {
                    input: onEditorInput,
                    keydown: onHotkey,
                    focus: (e) => { (e.target as HTMLTextAreaElement).scrollIntoView({ behavior: 'smooth', block: "center" }); },
                }
            }),

            h('button#send-eval.btn', {
                props: {
                    disabled: (code.trim() === "") || loadingOutput
                },
                on: {
                    click: sendEval
                }
            }, loadingOutput ? 'Evaluating...' : 'Evaluate'),

            outtypeInput("svg"),
            outtypeInput("png"),

            ...(!nothingEverHappened && !loadingOutput && !(status == "err") ? [
                h("button.share btn", {
                    on: { click: downloadOutput }
                }, "Save"),
                h("button.btn.share", {
                    class: { share: true },
                    on: { click: copyOutputToClipboard }
                }, "Copy"),
            ] : []),

            h('button#start-demo.btn', { on: { click: startDemo } }, 'Demo!'),

            ...(!loadingOutput && status === "err" ? [
                h("p", {}, "Compiler errors:"),
                h("pre#compiler-error", {
                    on: {
                        click: (e) => {
                            const selection = window.getSelection();
                            const range = document.createRange();
                            range.selectNodeContents(e.target);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        },
                    },
                }, errmsg),
                h("p", {}, "You are really bad at this, aren't you? Can you even draw a square? Here's some random tutorial:"),
                h("a", { props: {href: "https://asymptote.sourceforge.io/asymptote_tutorial.pdf"} }, "Tutorial"),
            ] : []),

            ...(!nothingEverHappened && !loadingOutput && !(status == "err") ? [
                h('div#output', { }, renderOutput())
            ] : []),
        ]);
    };

    type TimerJob = number;
    let debounceTimer: TimerJob | null;
    let demoTimer: TimerJob | null;
    let demoCodeIdx = 0;
    const demoCode = `\
import three;
size(10cm, 0);
currentlight = light(diffuse = new pen[] {blue, green},
specular = new pen[] {black, white},
position = new triple[] {-Y+Z, X+Y});
draw(unitsphere, surfacepen=white);`;

    const startDemo = () => {
        demoTimer = setTimeout(() => {
            demoCodeIdx = 0;
            state.code = "";
            redraw();
            const next = () => {
                if (demoCodeIdx < demoCode.length) {
                    state.code += demoCode[demoCodeIdx];
                    demoCodeIdx++;
                    const delay = 10;
                    demoTimer = setTimeout(next, delay);
                } else {
                    document.querySelector("#send-eval").click();
                }
                redraw();
            };
            next();
        }, 0);
    };


    const contentType = () => {
        const { outputType } = state;
        switch (outputType) {
            case "svg": return "image/svg+xml";
            case "png": return "image/png";
            default: throw new Error("invalid type " + outputType);
        }
    };

    const renderOutput = () => {
        const { svgText, pngUrl, outputType } = state;
        switch (outputType) {
        case "svg": return h('div', { props: { innerHTML: svgText } });
        case "png": return h('img', {
                props: {
                    src: pngUrl,
                },
                style: { maxWidth: '100%', height: 'auto' }
            });
        }
    };

    const onEditorInput = (e) => {
        if (demoTimer) return; // lock input
        if (scrollToResultTimer) { clearTimeout(scrollToResultTimer); scrollToResultTimer = null };
        state.code = e.target.value;
        resetdebouncer();
    };

    const onHotkey = (e) => { 
        if (e.ctrlKey && e.key === 'Enter' && state.code.trim() !== "") sendEval() 
        else if (e.key == "Escape") e.target.blur()
    };

    const onOuputChange = outputType => () => { 
        state.outputType = outputType;
        if (state.outputType === "png" && state.pngUrl) {
            URL.revokeObjectURL(state.pngUrl);
            state.pngUrl = null;
        }
        sendEval();
    }

    let scrollToResultTimer: TimerJob | null = null;

    const sendEval = async () => {
        const { code, outputType } = state;
        if (code.trim() === "") return;

        if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null };

        state.loadingOutput = true;
        state.nothingEverHappened = false;
        state.status = null;
        state.errmsg = null;
        redraw();

        try {
            const response = await fetch(`${API_SERVER}/eval`, {
                method: 'POST',
                headers: {
                    Accept: contentType(),
                },
                body: state.code
            });
            const blob = await response.blob();
            if (response.headers.get("Content-Type") === "text/vnd.asy-compiler-error") {
                state.status = "err"; 
                state.errmsg = await blob.text();
            } else {
                state.status = "ok";
                switch (outputType){
                    case "svg":
                        const svgText = await blob.text();
                        state.svgText = svgText;
                        break;
                    case "png":
                        const pngUrl = URL.createObjectURL(blob);
                            state.pngUrl = pngUrl;
                            state.pngBlob  = blob;
                        break;
                }
            }
        } catch (exc) {
            state.status = "err";
            state.errmsg = `Just kidding, there's no compiler error;\nI caught an exception while performing an HTTP request.\n${exc}`;
        } finally {
            state.loadingOutput = false;
            redraw();
            if (state.status != null) scrollToResultTimer = setTimeout(() => 
                document.getElementById((state.status === "ok" ) ? "output" :"compiler-error")!
                .scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'end'
                }), 50);
        }
    };

    const downloadOutput = () => {
       const { outputType, svgText, pngBlob } = state;

        const downloadFromBlob = (blob, name) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        switch (outputType) {
        case "svg": 
            downloadFromBlob(new Blob([svgText], { type: 'image/svg+xml' }), "asy.svg");
            break;
        case "png": 
            downloadFromBlob(pngBlob, "asy.png");
            break;
        }
    };

    const copyOutputToClipboard = () => {
        const { svgText, outputType, pngBlob } = state;

        switch (outputType) {
            case "svg":
                navigator.clipboard.writeText(svgText);
                return;
            case 'png':
                if (navigator.clipboard && navigator.clipboard.write) {
                    const clipboardItem = new ClipboardItem({
                        [contentType()]: pngBlob
                    });
                    navigator.clipboard.write([clipboardItem]);
                } else {
                    alert('Your browser sucks');
                }
                return;
        }
    };

    const debounceMs = 4*1000;
    /// reset automatic evaluation timer and save editor state
    const resetdebouncer = () => {
        if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null };

        debounceTimer = setTimeout(() => {
            saveHash();
            saveLocalStorage();

            sendEval();
        }, debounceMs);
    };

    const saveHash = () => { window.location.hash = encodeURIComponent(state.code); };
    const saveLocalStorage = () => { localStorage.setItem("code", state.code); };

    const loadFromHash = () => {
        const hash = window.location.hash.substring(1);
        if (!hash) return "";
        const code = decodeURIComponent(hash);
        return code;
    }
    const loadFromLocalStorage = () => localStorage.getItem("code") || "";


    // initialize ...

    const code = loadFromHash();
    if (code !== "") {
        state.code = decodeURIComponent(code) 
        saveLocalStorage();
    } else {
        const code = loadFromLocalStorage();
        if (code !== "") {
            state.code = code
            saveHash();
        }
    }
    window.addEventListener('hashchange', () => {
        const code = loadFromHash();
        if (state.code !== code) {
            state.code = code;
            resetdebouncer();
            redraw();
        }
    });

    const patch = init([classModule, propsModule, styleModule, eventListenersModule]);

    let vnode: VNode | null = null;

    const redraw = () => {
        console.debug("redraw");
        vnode = patch(vnode || document.getElementById("app"), render());
    };

    // window.addEventListener('resize', () => redraw());

    redraw();

    resetdebouncer();

    // const textarea = document.getElementById('editor');
    // if (textarea) textarea.focus();
}

run();
