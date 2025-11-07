package main
import(
    "database/sql"
    _ "github.com/mattn/go-sqlite3"
)

var db *sql.DB

func initDB() {
	_db, err := sql.Open("sqlite3", "./app.db")
    if err != nil { panic(err) }
    db = _db
}

func closeDB() {
    if db != nil { db.Close() }
}
