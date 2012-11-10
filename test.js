#!/usr/bin/env node

var PuperGrep = require('./');

var logger = new PuperGrep();
logger.listen(8080, "127.0.0.1");

setInterval(function self() {
	logger.emit({test:Math.random()});
}, 1400);

