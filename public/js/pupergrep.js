jQuery(document).ready(function() {
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

	var logLinesTable     = jQuery("#log-lines"),
		logsListContainer = jQuery("#logs-list"),
		logsList          = jQuery(),
		pauseButton       = jQuery("#pause-button"),
		logNameFilter     = jQuery("#log-name-filter"),
		fontSizeSelector  = jQuery("#font-size"),
		currentLink       = jQuery("#current-link"),
		taggedInputs      = jQuery('#highlight-items, #grep-items'),
		joinTypes         = jQuery(".join-type"),
		grepJoinType      = jQuery("#grep-join-type"),
		highlightJoinType = jQuery("#highlight-join-type"),
		healthIcon        = jQuery("#health-icon"),
		activeLogHeart    = logsListContainer.find("li.log.active .heart"),
		logHighlighting   = false,
		connected         = false,
		healthIconTimer   = undefined,
		currentLog        = undefined,
		currentLogType    = undefined,
		bufferLength      = 20,
		outputPaused      = false,
		mouseDowned       = false,
		linkSeparator     = '!!!';

	pauseButton.click(function() {
		var pauseIcon = jQuery("#pause-icon"),
			pauseText = jQuery("#pause-text");

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
		var url = "/?";

		url += "buffer=" + encodeURIComponent(jQuery("#buffer-length").val());
		if (jQuery("#highlight-items").data('tags'))
			url += "&highlight=" + encodeURIComponent(jQuery("#highlight-items").data('tags').join(linkSeparator));
		if (jQuery("#grep-items").data('tags'))
			url += "&grep=" + encodeURIComponent(jQuery("#grep-items").data('tags').join(linkSeparator));
		url += "&name-filter=" + encodeURIComponent(jQuery("#log-name-filter").val());
		url += "&font-size=" + fontSizeSelector.val();
		url += "&highligh-join=" + highlightJoinType.data("join-type");
		url += "&grep-join=" + grepJoinType.data("join-type");

		if (currentLog) {
			url += "&log=" + currentLog;
		}

		currentLink.prop("href", url);
	}

	jQuery("#buffer-length").change(function() {
		var self  = jQuery(this),
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

	jQuery("#font-size-bigger").click(function() {
		fontSizeSelector.val(+fontSizeSelector.val() + 1).change();
	});

	jQuery("#font-size-smaller").click(function() {
		fontSizeSelector.val(+fontSizeSelector.val() - 1).change();
	});

	joinTypes.click(function() {
		var trigger = jQuery(this),
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
		var $target = jQuery(e.target);
		$target.data('tags', data);
		rebuildCurrentLink();
	});


	taggedInputs.keyup(function() {
		var input     = jQuery(this),
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
			jQuery(this).parent().removeClass("error")
		} catch (e) {
			jQuery(this).parent().addClass("error");
			return;
		}

		logsList.each(function(index, node) {
			// slow piece of shit
			var element = jQuery(node);
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
		var element = jQuery(this);

		logHighlighting = true;

		logLinesTable.find("tr.log-line").remove();
		logsListContainer.children("li.log").removeClass("active");

		element.addClass("active");
		socket.emit("subscribe", {
			name: element.data("log-name")
		});

		currentLog     = element.data("log-name");
		currentLogType = element.data("log-type");

		rebuildCurrentLink();

		activeLogHeart = logsListContainer.find("li.log.active .heart");
		logsList.each(function(index, node) {
			var element = jQuery(node);

			if (!element.hasClass("active")) {
				element.find(".heart").hide();
			}
		});

		setTimeout(function() {
			logHighlighting = false;
		}, 1000);
	});

	jQuery(window).keydown(function(e) {
		if (e.keyCode == KEY.SPACE && e.target == jQuery('body')[0]) {
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
			jQuery("#buffer-length").val(buffer).change();
		}
		if (highlight) {
			jQuery("#highlight-items").textext()[0].tags().addTags(highlight.split(linkSeparator));
		}
		if (grep) {
			jQuery("#grep-items").textext()[0].tags().addTags(grep.split(linkSeparator));
		}
		if (nameFilter) {
			jQuery("#log-name-filter").val(nameFilter).change();
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

		jQuery(data.logs).each(function(index, log) {
			var container = jQuery("<li>"),
				link      = jQuery("<a>"),
				heart     = jQuery("<i>");

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

	function addLogLine(text, isRaw) {
		var logHeart = activeLogHeart,
			lines,
			container,
			line;

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

		container = jQuery("<tr>");
		line      = jQuery("<td>");

		if (currentLogType == "html") {
			line.html(text);
		} else {
			// escaping html
			text = text.split("&").join("&amp;").split( "<").join("&lt;").split(">").join("&gt;");
			// making some links
			text = text.replace(/(https?:\/\/[^\s]+)/g, function(url) {
				return '<a href="' + url + '">' + url + '</a>';
			});

			line.html(text);
		}

		if (currentLogType == "ansi") {
			line.colorizeConsoleOutput();
		}

		if (!isGrepAcceptedLine(text)) {
			return;
		}

		if (isHighlightedLine(text)) {
			container.addClass("alert");
		}

		container.addClass("log-line");
		container.append(line);

		logLinesTable.append(container);

		while (true) {
			lines = logLinesTable.find("tr.log-line");
			if (lines.length > bufferLength) {
				lines.first().remove();
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
		var conditions = jQuery("#highlight-items").data('tags'),
			type       = highlightJoinType.data("join-type");

		if (!conditions || conditions.length == 0) {
			return false;
		}

		return isAcceptedByConditionsJoinType(text, conditions, type);
	}

	function isGrepAcceptedLine(text) {
		var conditions = jQuery("#grep-items").data('tags'),
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
});
