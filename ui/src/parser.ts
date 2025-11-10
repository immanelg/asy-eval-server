
type TokenType = 
    | "None"
    | "Ident"
    | "Keyword"
    | "String"
    | "Number"
    | "Operator"
    | "Punctuation"

type Token = {type: TokenType, value: string}

const lexdef = {
  operators: [
    "+", "-", "*", "/", "#", "%", "^", "**",
    "==", "!=", "<", "<=", ">", ">=",
    "&&", "||", "!",
    "&", "|",
    "=", "+=", "-=", "*=", "/=", "#=", "%=", "^=",
    "++", "--",
    "::", "..", "---", "^^",
    "<<", ">>", "$", "$$", "@", "@@", "~", "<>",
    "controls", "tension", "atleast", "curl"
  ],
  keywords: [
    "and",
    "controls",
    "tension",
    "atleast",
    "curl",
    "if",
    "else",
    "while",
    "for",
    "do",
    "return",
    "break",
    "continue",
    "struct",
    "typedef",
    "new",
    "access",
    "import",
    "unravel",
    "from",
    "include",
    "quote",
    "static",
    "public",
    "private",
    "restricted",
    "this",
    "explicit",
    "operator"
  ],
  punctuation: [
    ",", ":", ";", "(", ")", "[", "]", "{", "}", ".", "..."
  ],
  literals: [
    "true", "false", "null", "cycle", "newframe"
  ]
}

const isnum = (c: string): boolean => {
    const char = c.charCodeAt(0);
    return char > 47 && char < 58;
}
const isident = (c: string): boolean => {
    const char = c.charCodeAt(0);
    return c === "_" 
        || char > 64 && char < 91 
        || char > 96 && char < 123;
}
const isspace = (c: string): boolean => {
    return c === " " || c === "\n" || c === "\r" || c === "\t";
}
const ispunc = (c: string): boolean => {
    return c === "(" || c === ")" 
        || c === "=" || c === ";" 
        || c === "{" || c === "}"
        || c === "*" || c === "+"
        || c === "," || c === "." || c === ":" 
    ;
}
export function lex(s: string): Token[] {
    const eof = i => i > s.length-1;
    let i = 0;
    let line = 1;
    const tokens: Token[] = [];
    main: while (true) {
        if (eof(i)) break main;
        if (s[i] === "'") {
            let token: Token = {type: "String", value: ""};

            token.value += s[i];
            i++;
            while (!eof(i) && s[i] !== "'") {
                token.value += s[i];
                i++;
                if (!eof(i) && s[i-1] === "\\" && s[i] === "'") {
                    token.value += s[i+1];
                    i++
                }
            }
            if (!eof(i)) { 
                token.value += s[i];
                i++;
            }

            tokens.push(token);
        } else if (s[i] === '"') {
            let token: Token = {type: "String", value: ""};

            token.value += s[i];
            i++;
            while (!eof(i) && s[i] !== '"') {
                token.value += s[i];
                i++;
                if (!eof(i) && s[i-1] === "\\" && s[i] === '"') {
                    token.value += s[i+1];
                    i++
                }
            }
            if (!eof(i)) { 
                token.value += s[i];
                i++;
            }
            tokens.push(token);
        } else if (isident(s[i])) {
            let token: Token = {type: "Ident", value: ""};
            let first = true;
            while (!eof(i) && ((!first && isnum(s[i]) || isident(s[i])))) {
                first = false;
                token.value += s[i];
                i++;
            }
            tokens.push(token);
        } else if (isnum(s[i])) {
            let token: Token= {type: "Number", value: ""};
            while (!eof(i) && isnum(s[i])) {
                token.value += s[i];
                i++;
            }
            tokens.push(token);
        } else if (ispunc(s[i])) {
            let token: Token = {type: "Punctuation", value: s[i]};
            i++;
            tokens.push(token);
        } else if (isspace(s[i])) {
            let token: Token = {type: "None", value: ""};
            while (!eof(i) && isspace(s[i])) {
                token.value += s[i];
                i++;
            }
            tokens.push(token);
        } else {
            console.debug("unhandled char (skipping)", s[i]);
            let token: Token = {type: "None", value: s[i]};
            tokens.push(token);
            i++;
        }
    }
    return tokens;
}

const test = `
    int x_0 = 12;
    import triangles;
    string x = "quote:\"\""
    if (x == 1) return "abcd";
`;

for (const token of lex(test)) 
    console.log(token);

