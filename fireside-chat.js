(function($) {
	var ID_PREFIX = 'js-message-';
	var message = function(id) {
    	return $('#' + ID_PREFIX + id);
    };

    var identity = function(input) {
		return input;
	};

	$.extend({
		firesideMessage: function(firebase, name, message, extras) {
			firebase.push($.extend({
				created: new Date().getTime(),
				name: name,
				message: message
			}, extras));
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
				newerMessagesOnTop: true
			}

			return this.each(function() {
				var $this = $(this);
    			var opts = $.extend({}, defaults, $this.data(), options);
				var ref = opts.messages ? ref.orderByValue().limitToLast(opts.messages) : firebase;
				
				ref.on('child_added', function(snapshot, prevKey) {
					var msg = snapshot.val();
					msg.created = opts.formatDate(new Date(msg.created));
					msg.message = opts.formatMessage(msg.message);

					var ele = opts.mergeTemplate(opts.template, opts.fillModel(msg)).attr('id', ID_PREFIX + snapshot.key()).
						data('message', msg);
					console.info(message(prevKey).length);
					if (prevKey) {
						if (opts.newerMessagesOnTop) {
							message(prevKey).before(ele);
						} else {
							message(prevKey).after(ele);
						}
					} else {
						$this.append(ele);
					}

					ele.trigger('firesideMessageAdded');
				});

				ref.on('child_removed', function(snapshot) {
					message(snapshot.key()).remove();
				});
    		});
    	}
	});
}) (jQuery);