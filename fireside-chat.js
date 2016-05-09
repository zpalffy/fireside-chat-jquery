(function($) {
	var ID_PREFIX = 'js-message-';
	var message = function(id) {
    	return $('#' + ID_PREFIX + id);
    };

    var identity = function(input) {
		return input;
	};

	var loadMessages = function(ref, ele, opts) {
			if (ref.scroll.hasNext() && ele.data('waitingForMessages') <= 0) {
				ele.data('waitingForMessages', opts.messages);
				ref.scroll.next(opts.messages);
			}
	};

	$.extend({
		firesideMessage: function(firebase, name, message, extras) {
			var now = Date.now();
			firebase.push($.extend({
				created: now,
				name: name,
				message: message
			}, extras)).setPriority(0 - now);
		}
	});

 	$.fn.extend({
 		firesideChat: function(firebase, options) {
			var defaults = {
				template: '<li>{{name}} ({{created}}) - {{message}}</li>',
				formatDate: identity,
				formatMessage: identity,
				fillModel: identity,
				mergeTemplate: function(template, model) {
					var t = template;
        			for (attr in model) {
            			t = t.replace(new RegExp("{{" + attr + "}}", 'g'), model[attr]);
        			}

        			return $(t);
    			},
				messages: 20,
				scrollOffset: 50
			}

			return this.each(function() {
				var $this = $(this);
    			var opts = $.extend({}, defaults, $this.data(), options);
    			var ref = new Firebase.util.Scroll(firebase, '$priority');
    			$this.data('waitingForMessages', 0);

				$this.on('scroll', function() {
					if (this.scrollHeight - $this.scrollTop() <= $this.outerHeight() + opts.scrollOffset) {
						loadMessages(ref, $this, opts);
					}
				});
				
				ref.on('child_removed', function(snapshot) {
					message(snapshot.key()).remove();
				});

				ref.on("child_added", function(snapshot, prevKey) {
					$this.data('waitingForMessages', $this.data('waitingForMessages') - 1);
					var msg = snapshot.val();
					msg.created = opts.formatDate(new Date(msg.created));
					msg.message = opts.formatMessage(msg.message);
					var id = ID_PREFIX + snapshot.key();
					if (!$('#' + id).length) {
						var newEle = opts.mergeTemplate(opts.template, opts.fillModel(msg)).attr('id', id).
							data('message', msg).data('priority', snapshot.getPriority());
							
						if (prevKey) {
							message(prevKey).after(newEle);
						} else {
							$this.prepend(newEle);
						}

						newEle.trigger('firesideMessageAdded');
					}
			   	});

				loadMessages(ref, $this, opts);
    		});
    	}
	});
}) (jQuery);