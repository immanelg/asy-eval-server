
type TokenType = 
    | "Ident"
    | "Keyword"
    | "String"
    | "Operator"
    | "Punctuation"

type Token = {token: TokenType, span: [number, number], value: string}

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

type Lexer = {
    i: number;
    line: number;
}

const lex = (code: string): Token[] => {
    const l: Lexer = {i: 0, line: 1};
    const tokens = [];
    while (true) {
        const c = code[l.i];
        const token: Token = {};
        l.i++;
        if (l.i > code.length-1) {}
        switch (c) {
        case "'":
        case '\r':
        case '\n':
            l.line++;
        case ' ':
        case '\t':
            break;
        }
    }
}
