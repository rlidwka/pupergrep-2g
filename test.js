#!/usr/bin/env node

var PuperGrep = require('./');

var logger = new PuperGrep();
logger.listen(8080, "0.0.0.0");

logger.on('connection', function(client) {
	var connected = true;
	client.on('disconnect', function() {
		connected = false;
	});

	setInterval(function self() {
		client.send({test:Math.random()});
	}, 1400);
});

