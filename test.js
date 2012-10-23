#!/usr/bin/env node

var PuperGrep = require("./"),
	puper     = new PuperGrep(),
	manager   = puper.getLogReaderManager();

manager.addLog("my_cool_log", "/tmp/test", function(error) {
	if (error) {
		console.log("Error adding test log", error);
		return;
	}

	puper.listen(8080, "127.0.0.1");
});
