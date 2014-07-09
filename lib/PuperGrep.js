
var socketIO = require("socket.io");
var HTTP = require("http");
var url  = require("url");
var path = require("path");
var util = require("util");
var events = require("events");
var Mincer = require("mincer");
Mincer.MacroProcessor.configure('.html');

function Client(socket)
{
	var self = this;
	self.send = function(line) {
		socket.emit("line", {line: line});
	};

	socket.on("disconnect", function() {
		self.send = function(){};
		self.emit('disconnect');
	})
};

util.inherits(Client, events.EventEmitter);

function PuperGrep()
{
};

util.inherits(PuperGrep, events.EventEmitter);

PuperGrep.prototype.listen = function()
{
	var self = this;
	var env = new Mincer.Environment();
	env.appendPath(path.join(__dirname, '..', 'assets'));
	env.registerPreProcessor('text/html', Mincer.MacroProcessor);
	env.registerPostProcessor('application/javascript', Mincer.SafetyColons);
	env.ContextClass.defineAssetPath(function(pathname, options) {
		var asset = env.findAsset(pathname);
		if (!asset) throw new Error("asset "+pathname+" not found");
		return '/' + asset.digestPath;
	});
	env.registerHelper('asset_include', function(pathname) {
		pathname = this.resolve(pathname, {contentType: '~self~'});
		this.dependOnAsset(pathname);
		return require('fs').readFileSync(pathname, 'utf8');
	});

	self.mincer = Mincer.createServer(env);

	self.http = HTTP.createServer(function(req, res) {
		if (req.url === '/') {
			res.writeHead(301, {location: '/index.html'});
			res.end('see /index.html');
		} else {
			self.mincer(req, res, function() {
				res.writeHead(404);
				res.end('Not found');
			});
		}
	});

	var io = socketIO.listen(this.http, {
		"log level": 2 // info
	});

	io.sockets.on("connection", function(socket) {
		var client = new Client(socket);
		self.emit('connection', client)
	});

	this.http.listen.apply(self.http, arguments);
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

