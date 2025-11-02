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

const API_SERVER = "http://localhost:8000"

const run = async () => {

    interface State {
        code: string;
        outtype: "svg" | "png";
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
        outtype: "svg",
        svgText: "",
        pngUrl: "",
        pngBlob: null,
        loadingOutput: false, 
        nothingEverHappened: true, 
        status: null,
        errmsg: null,
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
            setState({code: ""});
            const next = () => {
                if (demoCodeIdx < demoCode.length) {
                    setState({ code: state.code + demoCode[demoCodeIdx] });
                    demoCodeIdx++;
                    const delay = 10;
                    demoTimer = setTimeout(next, delay);
                } else {
                    document.querySelector("#send-eval").click();
                }
            };
            next();
        }, 0);
    };


    const contentType = () => {
        const { outtype } = state;
        switch (outtype) {
            case "svg": return "image/svg+xml";
            case "png": return "image/png";
            default: throw new Error("invalid type " + outtype);
        }
    };

    const renderOutput = () => {
        const { svgText, pngUrl, outtype } = state;
        switch (outtype) {
        case "svg": return h('div', { innerHTML: svgText });
        case "png": return h('img', {
                props: {
                    src: pngUrl,
                },
                style: { maxWidth: '100%', height: 'auto' }
            });
        }
    };

    const onEditorInput = (e) => {
        if (demoTimer) {
            clearTimeout(demoTimer);
        }
        const newCode = e.target.value;
        state.code = newCode;
        saveHash();
        saveLocalStorage();
        resetdebouncer();
    };

    const onKeybinding = (e) => 
        { if (e.ctrlKey && e.key === 'Enter' && state.code.trim() !== "") sendEval() };

    const onOuputChange = outtype => () => { 
        state.outtype = outtype;
        sendEval();
    }

    const view = () => {
        const { code, outtype, loadingOutput, nothingEverHappened, status, errmsg } = state;

        return h('div', {}, [
            h('h1', {}, 'Asymptote Evaluator'),

            h('a', {
                class: { 'github-button': true },
                props: {
                    href: 'https://github.com/immanelg/asy-eval-server',
                    'data-color-scheme': 'no-preference: light; light: light; dark: dark;',
                    'data-size': 'large',
                    'data-show-count': 'true',
                    'aria-label': 'Star immanelg/asy-eval-server on GitHub'
                }
            }, 'Star'),

            h('textarea', {
                props: {
                    id: 'editor',
                    value: code
                },
                class: { [status]: true },
                on: {
                    input: onEditorInput,
                    keydown: onKeybinding
                }
            }),

            h('button', {
                props: {
                    id: 'send-eval',
                    disabled: (code.trim() === "") || loadingOutput
                },
                on: {
                    click: sendEval
                }
            }, loadingOutput ? 'Evaluating...' : 'Evaluate'),

            h('label', {
                class: { typeswitch: true }
            }, [
                h('input', {
                    props: {
                        type: 'radio',
                        name: 'outtype',
                        checked: outtype == "svg"
                    },
                    on: {
                        change: onOuputChange("svg"),
                    }
                }),
                h("span", {}, 'SVG'),
            ]),

            h('label', {
                class: { typeswitch: true }
            }, [
                h('input', {
                    props: {
                        type: 'radio',
                        name: 'outtype',
                        checked: outtype == "png"
                    },
                    on: {
                        change: onOuputChange("png"),
                    }
                }),
                h("span", {}, 'PNG'),
            ]),

            ...(!nothingEverHappened && !loadingOutput && !(status == "err") ? [
                h("button", {
                    class: { share: true },
                    on: { click: downloadOutput }
                }, "Save"),
                h("button", {
                    class: { share: true },
                    on: { click: copyOutputToClipboard }
                }, "Copy"),
            ] : []),

            h('button', {
                class: { 'start-demo': true },
                on: { click: startDemo }
            }, 'Demo!'),

            ...(!loadingOutput && status === "err" ? [
                h("p", {}, "Compiler error:"),
                h("pre", {
                    props: {
                        id: "compiler-error"
                    }
                }, errmsg),
            ] : []),

            ...(!nothingEverHappened && !loadingOutput && !(status == "err") ? [
                h('div', {
                    props: {
                        id: 'output'
                    }
                }, renderOutput())
            ] : []),
        ]);
    };

    const sendEval = async () => {
        const { code, outtype } = state;
        if (code.trim() === "") return;

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
                const errmsg = await blob.text();
                state.status = "err"; state.errmsg = errmsg;
                setTimeout(() => document.getElementById('compiler-error')!.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                }), 500);
            } else {
                state.status = "ok";
                switch (outtype){
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

                setTimeout(() => document.getElementById('output')!.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                }), 500);
            }
        } catch (error) {

        } finally {
            state.loadingOutput = false;
            redraw();
        }
    };

    const downloadOutput = () => {
       const { outtype, svgText, pngBlob } = state;

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
        switch (outtype) {
        case "svg": 
            downloadFromBlob(new Blob([svgText], { type: 'image/svg+xml' }), "asy.svg");
            break;
        case "png": 
            downloadFromBlob(pngBlob, "asy.png");
            break;
        }
    };

    const copyOutputToClipboard = () => {
        const { svgText, outtype, pngBlob } = state;

        switch (outtype) {
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

    const resetdebouncer = () => {
        const { code } = state;

        window.location.hash = encodeURIComponent(code);
        localStorage.setItem("code", code);

        if (debounceTimer) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            sendEval();
        }, 1000);
    };

    const onHashChange = () => {
        const hash = window.location.hash.substring(1);
        if (hash !== "") {
            const code = decodeURIComponent(hash);
            if (state.code !== code) {
                state.code = code;
                saveHash();
                saveLocalStorage();
                resetdebouncer();
            }
        }
    };

    const saveHash = () => { console.debug("savehash"); window.location.hash = encodeURIComponent(state.code); };
    const saveLocalStorage = () => { localStorage.setItem("code", state.code); };

    const loadFromHash = () => {
        const hash = window.location.hash.substring(1);
        if (!hash) return;
        const code = decodeURIComponent(hash);
        if (state.code !== code) state.code = code;
    }
    const loadFromLocalStorage = () => state.code = localStorage.getItem("code") || "";

    const hash = window.location.hash.substring(1);
    state.code = hash !== "" ? decodeURIComponent(hash) : localStorage.getItem("code") || "";
    saveHash();
    saveLocalStorage();
    resetdebouncer();

    window.addEventListener('hashchange', onHashChange);

    setTimeout(() => {
        const textarea = document.getElementById('editor');
        if (textarea) textarea.focus();
    }, 0);

    const patch = init([classModule, propsModule, styleModule, eventListenersModule]);

    let vnode: VNode | null = null;

    const redraw = () => {
        console.timeStamp("redraw");
        vnode = patch(vnode || document.getElementById("app"), view());
    };

    redraw();

}

run();
