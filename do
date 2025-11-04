#!/usr/bin/bash
set -e

ROOT="$(realpath $(dirname ${BASH_SOURCE[0]}))"
cd "$ROOT"

export PATH="$ROOT/ui/node_modules/.bin:$PATH"

API_ADDR="localhost:8050"

@ui() {
    export VITE_API_URL="http://${API_ADDR}"
    cd ui
    case "$1" in 
    watch) vite dev --open ;;
    run) vite preview --open;;
    build) tsc && vite build ;;
    check) tsc ;;
    test) exit 0 ;;
    fmt) prettier . --write;;
    *) echo "unknown subcommand" ;;
    esac
}

@api() {
    cd api
    case "$1" in 
    watch) watchexec -r -e go go run . -addr ${API_ADDR} ;;
    run) go run . ;;
    build) go build -o api . ;;
    check) go vet . ;;
    test) exit 0 ;;
    fmt) go fmt .;;
    *) echo "unknown subcommand" ;;
    esac
}

##################################################################################################
DEFAULT=help
@help() {
    echo "do™️: Manage this project."
    echo 
    echo "Available commands:"
    compgen -A function @ | sed "s|^@|\t$0 |"
}

if [[ -z $1 ]]; then
    eval "@$DEFAULT"
else
    if compgen -A function "@$1" >/dev/null; then
        task="@$1"; shift
        eval "$task \"\$@\""
    else
        echo "No such task: $1"
        echo
        @help
        exit 1
    fi
fi
