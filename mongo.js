#!/usr/bin/env node

var mongode = require('mongode');
var PuperGrep = require('./');

var logger = new PuperGrep();
logger.listen(8080, "127.0.0.1");

var db = mongode.connect("mongo://127.0.0.1/broadsend", {server: {auto_reconnect: true}});
db.collection('logs');

logger.on('connection', function(client) {
	var connected = true;
	client.on('disconnect', function() {
		connected = false;
	});

	var lastid = new mongode.ObjectID('000000000000000000000000');
	(function get_updates() {
		db.logs.find({_id: {$gt: lastid}}).sort({_id: -1}).limit(20).toArray(function(err, logs) {
			//console.log(err, logs);
			if (logs && logs.length) {
				for (var i=logs.length-1; !(i < 0); i--) {
					client.send(logs[i]);
				}
				lastid = logs[0]._id;
			}
			if (connected) setTimeout(get_updates, 1000);
		});
	})();
});

