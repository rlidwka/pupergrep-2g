
var socketIO = require("socket.io");
var HTTP = require("http");
var send = require("send");
var url  = require("url");
var path = require("path");

function start(port, host)
{
	var http = HTTP.createServer(function(req, res) {
		var file = url.parse(req.url).pathname;
		var root = path.join(__dirname, "..", "public");
		send(req, file).root(root).pipe(res);
	});

	var io = socketIO.listen(http, {
		"log level": 2 // info
	});

	io.sockets.on("connection", function(socket) {
		(function self() {
			if (!socket) return;

			var line = {line: JSON.stringify({xx: Math.random()})};
			socket.emit("line", line);
			setTimeout(self, 1500);
		})();

		socket.on("disconnect", function() {
			socket = undefined;
		});
	});

	http.listen(port, host);
	return http;
};

module.exports.start = start;

