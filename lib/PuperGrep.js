
var socketIO = require("socket.io");
var HTTP = require("http");
var send = require("send");
var url  = require("url");
var path = require("path");

function PuperGrep()
{
	this.connections = [];
};

PuperGrep.prototype.listen = function()
{
	var self = this;
	self.http = HTTP.createServer(function(req, res) {
		var file = url.parse(req.url).pathname;
		var root = path.join(__dirname, "..", "public");
		send(req, file).root(root).pipe(res);
	});

	var io = socketIO.listen(this.http, {
		"log level": 2 // info
	});

	io.sockets.on("connection", function(socket) {
		self.connections.push(socket);

		socket.on("disconnect", function() {
			self.connections = self.connections.filter(function(s) {
				return s != socket;
			});
		});
	});

	this.http.listen.apply(self.http, arguments);
	return this;
};

PuperGrep.prototype.emit = function(event) {
	this.connections.forEach(function(socket) {
		socket.emit("line", {line: event});
	});
	return this;
};

PuperGrep.prototype.close = function()
{
	if (this.http) {
		this.http.close();
	};
	return this;
};

module.exports = PuperGrep;

