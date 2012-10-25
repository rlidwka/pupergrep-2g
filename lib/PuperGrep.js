
var socketIO = require("socket.io");
var HTTP = require("http");
var url  = require("url");
var path = require("path");

function PuperGrep()
{
	this.connections = [];
};

PuperGrep.prototype.listen = function()
{
	var self = this;
	self.pipeline = require('asset-pipeline')({
		assets: path.join(__dirname, "..", "assets"),
		cache: path.join(__dirname, "..", "cache"),
		extensions: ['html', 'js', 'css', 'png'],
	});

	self.http = HTTP.createServer(function(req, res) {
		if (req.url === '/') {
			res.writeHead(301, {location: '/index.html'});
			res.end('see /index.html');
		} else {
			self.pipeline(req, res, function() {
				res.writeHead(404);
				res.end('Not found');
			});
		}
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

