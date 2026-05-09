const db = require("sqlite3").verbose();
const conn = new db.Database("C:\\Users\\md majdi\\AppData\\Local\\DupScan\\dupscan.db");
conn.run("PRAGMA foreign_keys = ON", () => {
  const now = Math.floor(Date.now() / 1000);
  conn.run(
    "INSERT INTO duplicate_groups (hash, file_count, waste_bytes, file_size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ["testhash123", 2, 100, 50, now, now],
    function(err) {
      if (err) console.log("INSERT error:", err.message);
      else console.log("Inserted, lastID=" + this.lastID);
      conn.all("SELECT * FROM duplicate_groups", (e, rows) => {
        console.log("Rows:", rows);
        conn.close();
      });
    }
  );
});
