$(document).ready(function() {
	var KEY = window.KEY = {
		LEFT: 37,
		UP: 38,
		RIGHT: 39,
		DOWN: 40,
		DEL: 8,
		TAB: 9,
		RETURN: 13,
		ENTER: 13,
		ESC: 27,
		PAGEUP: 33,
		PAGEDOWN: 34,
		SPACE: 32
	};

	var
		logLinesTable     = $("#log-lines"),
		logsListContainer = $("#logs-list"),
		logsList          = $(),
		pauseButton       = $("#pause-button"),
		logNameFilter     = $("#log-name-filter"),
		fontSizeSelector  = $("#font-size"),
		currentLink       = $("#current-link"),
		taggedInputs      = $('#highlight-items, #grep-items'),
		joinTypes         = $(".join-type"),
		grepJoinType      = $("#grep-join-type"),
		highlightJoinType = $("#highlight-join-type"),
		healthIcon        = $("#health-icon"),
		activeLogHeart    = logsListContainer.find("li.log.active .heart"),
		logHighlighting   = false,
		connected         = false,
		healthIconTimer   = undefined,
		currentLog        = undefined,
		bufferLength      = 20,
		outputPaused      = false,
		mouseDowned       = false,
		linkSeparator     = '!!!';

	pauseButton.click(function() {
		var pauseIcon = $("#pause-icon"),
			pauseText = $("#pause-text");

		if (!outputPaused) {
			pauseIcon.removeClass("icon-pause");
			pauseIcon.addClass("icon-play");
			pauseText.text("Resume");
			outputPaused = true;
			addLogLine("Output paused");
		} else {
			pauseIcon.removeClass("icon-play");
			pauseIcon.addClass("icon-pause");
			pauseText.text("Pause");
			outputPaused = false;
			addLogLine("Output resumed");
		}
	});

	function rebuildCurrentLink() {
		var url = document.location.pathname + "?";

		url += "buffer=" + encodeURIComponent($("#buffer-length").val());
		if ($("#highlight-items").data('tags'))
			url += "&highlight=" + encodeURIComponent($("#highlight-items").data('tags').join(linkSeparator));
		if ($("#grep-items").data('tags'))
			url += "&grep=" + encodeURIComponent($("#grep-items").data('tags').join(linkSeparator));
		url += "&name-filter=" + encodeURIComponent($("#log-name-filter").val());
		url += "&font-size=" + fontSizeSelector.val();
		url += "&highligh-join=" + highlightJoinType.data("join-type");
		url += "&grep-join=" + grepJoinType.data("join-type");

		if (currentLog) {
			url += "&log=" + currentLog;
		}

		currentLink.prop("href", url);
	}

	$("#buffer-length").change(function() {
		var self  = $(this),
			value = parseInt(self.val());

		if (isNaN(value) || value <= 0) {
			self.parent().parent().addClass("error");
		} else {
			bufferLength = value;
			self.parent().parent().removeClass("error");
		}

		rebuildCurrentLink();
	});

	fontSizeSelector.change(function() {
		var fontSize = fontSizeSelector.val();
		if (fontSize >= 8 && fontSize <= 20) {
			logLinesTable.css("font-size", fontSize + "px");
			fontSizeSelector.parent().parent().removeClass("error");
		} else {
			fontSizeSelector.parent().parent().addClass("error");
		}

		rebuildCurrentLink();
	});

	$("#font-size-bigger").click(function() {
		fontSizeSelector.val(+fontSizeSelector.val() + 1).change();
	});

	$("#font-size-smaller").click(function() {
		fontSizeSelector.val(+fontSizeSelector.val() - 1).change();
	});

	joinTypes.click(function() {
		var trigger = $(this),
			type    = trigger.data("join-type") == "or" ? "and" : "or";

		trigger.data("join-type", type).text(type);
		rebuildCurrentLink();
		return false;
	});

	taggedInputs.textext({ plugins : 'tags' });
	taggedInputs.textext()[0].getFormData();
	taggedInputs.bind('isTagAllowed', function(e, data) {
		try {
			new RegExp(data.tag);
		} catch (e) {
			data.result = false;
		}
	});
	taggedInputs.bind('setFormData', function(e, data, isEmpty) {
		var $target = $(e.target);
		$target.data('tags', data);
		rebuildCurrentLink();
	});


	taggedInputs.keyup(function() {
		var input     = $(this),
			container = input.parent().parent().parent();

		try {
			new RegExp(input.val());
			container.removeClass("error");
		} catch (e) {
			container.addClass("error");
		}
	});

	logNameFilter.keyup(function() {
		logNameFilter.change();
	});

	logNameFilter.change(function() {
		var regexp;

		try {
			regexp = new RegExp(logNameFilter.val(), "i");
			$(this).parent().removeClass("error")
		} catch (e) {
			$(this).parent().addClass("error");
			return;
		}

		logsList.each(function(index, node) {
			// slow piece of shit
			var element = $(node);
			if (element.data("log-name").match(regexp)) {
				if (element.is(':hidden')) {
					element.show()
				}
			} else {
				if (!element.is(":hidden")) {
					element.hide();
				}
			}
		});

		rebuildCurrentLink();
	});

	logsListContainer.delegate("li.log", "click", function() {
		var element = $(this);

		logHighlighting = true;

		logLinesTable.find("tr.log-line").remove();
		logsListContainer.children("li.log").removeClass("active");

		element.addClass("active");
		socket.emit("subscribe", {
			name: element.data("log-name")
		});

		currentLog     = element.data("log-name");

		rebuildCurrentLink();

		activeLogHeart = logsListContainer.find("li.log.active .heart");
		logsList.each(function(index, node) {
			var element = $(node);

			if (!element.hasClass("active")) {
				element.find(".heart").hide();
			}
		});

		setTimeout(function() {
			logHighlighting = false;
		}, 1000);
	});

	$(window).keydown(function(e) {
		if (e.keyCode == KEY.SPACE && e.target == $('body')[0]) {
			pauseButton.click();
			return false;
		}
	});

	logLinesTable.mousedown(function() {
		if (!outputPaused) {
			outputPaused = true;
			mouseDowned = true;
		}
	});

	logLinesTable.mouseup(function() {
		if (mouseDowned) {
			outputPaused = false;
			mouseDowned = false;
		}
	});

	(function initFromURI() {
		function getURLParameter(name) {
			var value = (RegExp(name + '=' + '(.*?)(&|$)').exec(location.search)||[,null])[1];
			return value !== null ? decodeURIComponent(value) : value;
		}

		var buffer        = getURLParameter("buffer"),
			log           = getURLParameter("log"),
			highlight     = getURLParameter("highlight"),
			grep          = getURLParameter("grep"),
			nameFilter    = getURLParameter("name-filter"),
			fontSize      = getURLParameter("font-size"),
			grepJoin      = getURLParameter("grep-join"),
			highlightJoin = getURLParameter("highligh-join");

		if (buffer) {
			$("#buffer-length").val(buffer).change();
		}
		if (highlight) {
			$("#highlight-items").textext()[0].tags().addTags(highlight.split(linkSeparator));
		}
		if (grep) {
			$("#grep-items").textext()[0].tags().addTags(grep.split(linkSeparator));
		}
		if (nameFilter) {
			$("#log-name-filter").val(nameFilter).change();
		}
		if (fontSize) {
			fontSizeSelector.val(fontSize).change();
		}
		if (log) {
			currentLog = log;
		}
		if (grepJoin && grepJoin != grepJoinType.data("join-type")) {
			grepJoinType.click();
		}
		if (highlightJoin && highlightJoin != highlightJoinType.data("join-type")) {
			highlightJoinType.click();
		}
	})();

	var socket = io.connect();

	socket.on("logs", function(data) {
		var selectLog;

		logsListContainer.children(".log").remove();

		$(data.logs).each(function(index, log) {
			var container = $("<li>"),
				link      = $("<a>"),
				heart     = $("<i>");

			heart.addClass("icon-heart").addClass("heart").hide();
			link.text(log.name);
			link.append(heart);
			container.data("log-name", log.name);
			container.data("log-type", log.type);
			container.addClass("log");
			container.append(link);

			logsListContainer.append(container);

			if (log.name == currentLog) {
				selectLog = container;
			}
		});

		if (selectLog) {
			selectLog.click();
		}

		logsList = logsListContainer.children("li.log");
		logNameFilter.change();

		rebuildCurrentLink();
	});

	function addLogLine(text) {
		var logHeart = activeLogHeart,
			lines,
			container,
			line,
			origObject;

		if (typeof(text) == 'object') {
			origObject = text;
			text = objectToText(text);
		}

		if (!logHighlighting) {
			logHighlighting = true;
			logHeart.fadeIn("slow", function() {
				logHeart.fadeOut("slow", function() {
					setTimeout(function() {
						logHighlighting = false;
					}, 500);
				});
			});
		}

		container = $("<tr>");
		line      = $("<td>");

		line.html(text);
		line.colorizeConsoleOutput();

		if (!isGrepAcceptedLine(text)) {
			return;
		}

		if (isHighlightedLine(text)) {
			container.addClass("alert");
		}

		container.addClass("log-line");
		container.append(line);
		container[0].origObject = origObject;

		logLinesTable.prepend(container);

		while (true) {
			lines = logLinesTable.find("tr.log-line");
			if (lines.length > bufferLength) {
				var toremove = lines.last();
				if (toremove.next().hasClass('log-object')) {
					toremove.next().remove();
				}
				lines.last().remove();
			} else {
				break;
			}
		}
	}

	// type must be "or" or any other string for "and"
	function isAcceptedByConditionsJoinType(value, conditions, type) {
		var condition;

		if (conditions && conditions.length) {
			for (var i in conditions) {
				condition = conditions[i];
				if (condition) {
					if ((type == "or") == !!value.match(new RegExp(condition))) {
						return type == "or";
					}
				}
			}
		}

		return type != "or";
	}

	function isHighlightedLine(text) {
		var conditions = $("#highlight-items").data('tags'),
			type       = highlightJoinType.data("join-type");

		if (!conditions || conditions.length == 0) {
			return false;
		}

		return isAcceptedByConditionsJoinType(text, conditions, type);
	}

	function isGrepAcceptedLine(text) {
		var conditions = $("#grep-items").data('tags'),
				type   = grepJoinType.data("join-type");

		return isAcceptedByConditionsJoinType(text, conditions, type);
	}

	socket.on("line", function(data) {
		if (outputPaused) {
			return;
		}

		addLogLine(data.line);
	});

	socket.on("disconnect", function() {
		connected = false;

		healthIcon.removeClass("icon-ok-circle")
				  .addClass("icon-ban-circle")
				  .prop("title", "Connection failed");

		(function animateDisconnect() {
			healthIcon.fadeOut("slow", function() {
				healthIcon.fadeIn("slow", function() {
					if (!connected) {
						healthIconTimer = setTimeout(animateDisconnect, 500);
					}
				});
			});
		})();

	});

	socket.on("connect", function() {
		connected = true;

		if (healthIconTimer) {
			clearTimeout(healthIconTimer);
			healthIconTimer = undefined;
		}

		healthIcon.removeClass("icon-ban-circle")
				  .addClass("icon-ok-circle")
				  .prop("title", "Connected");
	});

	window.scrollTo(0, 1);

	//// rlidwka's adds
	$(window).on('click', '.log-line', function() {
		if ($(this).next().hasClass('log-object')) {
			$(this).next().remove();
			return;
		}

		var text = window.utiljs.inspect(this.origObject, undefined, null, true);

		text = html_escape(text);
		text = replaceLeadingSpace(text);

		container = $("<tr>");
		container.addClass('log-object');
		container.html("<td>"+text+"</td>");
		container.colorizeConsoleOutput();

		$(this).after(container);
	});
	
	function replaceLeadingSpace(text) {
		return text.replace(/(^|\n)[ \t]+/g, function(br) {
			var result = br[0] == '\n' ? '<br>' : '';
			for (var i=0; i<br.length; i++) {
				if (br[i] === ' ') result += '&nbsp;';
				if (br[i] === '\t') result += '&nbsp;&nbsp;&nbsp;&nbsp;';
			}
			return result;
		});
	};

	var interpolateObject = (function() {
		function getlvl(x) {
			if (x < 15) {
				return 'trace';
			} else if (x < 25) {
				return 'debug';
			} else if (x < 35) {
				return 'info';
			} else if (x < 45) {
				return 'warn';
			} else if (x < 55) {
				return 'error';
			} else {
				return 'fatal';
			}
		}

		var print = function print(obj) {
			var type = obj.level;
			var msg = obj.msg;
			var finalmsg;
			if (typeof type === 'number') type = getlvl(type);
			finalmsg = msg.replace(/@{([$A-Za-z_][$0-9A-Za-z\._]*)}/g, function(_, name) {
				var id, str, _i, _len, _ref;
				str = obj;
				_ref = name.split('\.');
				for (_i = 0, _len = _ref.length; _i < _len; _i++) {
					id = _ref[_i];
					if (typeof str === 'object') {
						str = str[id];
					} else {
						str = void 0;
					}
				}
				return window.utiljs.inspect(str, undefined, undefined, true);
			});
			return ("<span class=\"log-prefix log-prefix-"+type+"\">" + type + "</span> &ndash; ") + html_escape(finalmsg);
		};

		return print;
	})();

	function html_escape(text) {
		// escaping html
		text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		// making some links
		text = text.replace(/(https?:\/\/[^\s]+)/g, function(url) {
			return '<a href="' + url + '">' + url + '</a>';
		});

		return text;
	}

	function objectToText(object) {
		if (typeof(object.msg) === 'string') {
			return interpolateObject(object);
		}
		return html_escape(window.utiljs.inspect(object, undefined, null, true));
	};
});
