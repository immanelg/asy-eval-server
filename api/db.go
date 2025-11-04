package main

import "database/sql"

func incCompilations(userID userID) error {
	db, err := sql.Open("sqlite3", "./app.db")
	if err != nil {
		return err
	}
	defer db.Close()

	_, err = db.Exec("UPDATE users SET evals = evals + 1 WHERE id = ?", userID)
	return err

}
