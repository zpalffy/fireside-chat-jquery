(function($) {
	var message = function(ele, id, opts) {
		return ele.find('.' + opts.messageClass + '-' + id);
	}

    var identity = function(input) {
		return input;
	};

	var loadMessages = function(ref, ele, opts) {
			if (ref.scroll.hasNext() && ele.data('waitingForMessages') <= 0) {
				ele.data('waitingForMessages', opts.messages);
				ref.scroll.next(opts.messages);
			}
	};

	var messageKeys = function() {
		return $.parseJSON(sessionStorage['messageIds'] || '[]');
	}

	var preMerge = function(msg, opts) {
		if (!opts.replacements) return msg;

		for (var key in opts.replacements) {
			var rep = opts.replacements[key];
			if (rep.replace) {
				var replaceValue = rep.replace;
				if (rep.encode && btoa) {
					replaceValue = function(match, p1) {
						return "base64::" + btoa(rep.replace.replace('$1', p1));
					};
				}

				msg = msg.replace(rep.search, replaceValue);
			}
			
		}

		return msg;
	}

	var postMerge = function(msg, opts) {
		if (!opts.shortCodes) return msg;

		for (var key in opts.shortCodes) {
			if (opts.shortCodes[key]) {
				msg = msg.replace(new RegExp(key + '::([\\w:\\-\\=\\+]+)', 'g'), opts.shortCodes[key]);
			}
		}		
		return msg;
	}

	$.extend({
		firesideMessage: function(firebase, name, message, extras) {
			var now = Date.now();
			var item = firebase.push();

			// get message ids from session and add new one
			var ids = messageKeys();
			ids.push(item.key());

			// set message ids to session
			sessionStorage.setItem('messageIds', JSON.stringify(ids));

			item.setWithPriority($.extend({
				created: now,
				name: name,
				message: message
			}, extras), 0 - now);			
		}
	});

 	$.fn.extend({
 		firesideChat: function(firebase, options) {
			var defaults = {
				template: '<li>{{name}} ({{created}}) - {{message}}</li>',
				formatDate: identity,
				formatMessage: identity,
				fillModel: identity,
				editButtons: '<p><button class="delete-message">Delete</button></p>',
				confirmDelete: function(reallyDelete) {
					if (confirm('Are you sure?')) {
						reallyDelete();
					}
				},
				mergeTemplate: function(template, model) {
					var t = template;
        			for (attr in model) {
            			t = t.replace(new RegExp("{{" + attr + "}}", 'g'), model[attr]);
        			}

        			return t;
    			},
    			showMessage: function(ele) {
    				ele.show();
    			},
    			replacements: {
    				youtube: {
    					search: /(?:https?:\/\/)?(?:www\.)?youtu(?:be\.com\/watch\?v=|\.be\/)([\w-]+)/ig,
    					replace: 'yt::$1'
    				},
    				vimeo: {
    					search: /(?:https?:\/\/)?(?:www\.)?vimeo.com\/(?:\w*\/)*([\w-]+)/ig,
    					replace: 'vimeo::$1'
    				},
    				image: {
    					search: /(https?:\/\/\S*\.(?:jpg|gif|jpeg|png))/ig,
    					replace: '<img src="$1" />'
    				},
    				audio: {
    					search: /(https?:\/\/\S*\.(?:mp3|ogg|wav))/ig,
    					replace: '<audio controls><source src="$1"></audio>',
    					encode: true
    				}
    			},
    			shortCodes: {
    				spotify: '<iframe class="media" src="https://embed.spotify.com/?uri=spotify:$1" width="300" height="380" frameborder="0" allowtransparency="true"></iframe>',
    				yt: '<iframe width="400" height="225" src="https://www.youtube.com/embed/$1" class="media" frameborder="0" allowfullscreen></iframe>',
    				vimeo: '<iframe class="media" src="https://player.vimeo.com/video/$1" width="640" height="360" frameborder="0" allowfullscreen></iframe>',
    				base64: function(match, p1) {
    					if (p1 && atob) {
    						return atob(p1);
    					}
    				}
    			},
    			messageClass: 'js-message',
    			deleteMessageSelector: '.delete-message',
    			preReplacements: [],
    			postReplacements: [],
				messages: 20,
				scrollOffset: 50
			}

			return this.each(function() {
				var $this = $(this);
    			var opts = $.extend(true, {}, defaults, $this.data(), options);
    			var ref = new Firebase.util.Scroll(firebase, '$priority');
    			$this.data('waitingForMessages', 0);

				$this.on('scroll', function() {
					if (this.scrollHeight - $this.scrollTop() <= $this.outerHeight() + opts.scrollOffset) {
						loadMessages(ref, $this, opts);
					}
				});

				$this.on('click', opts.deleteMessageSelector, function(evt) {
					var id = $(evt.target).closest('.' + opts.messageClass).data('messageId');
					opts.confirmDelete(function() {
						firebase.child(id).remove();
					});					
				});
				
				ref.on('child_removed', function(snapshot) {
					message($this, snapshot.key(), opts).remove();
				});

				ref.on("child_added", function(snapshot, prevKey) {
					var veryFirst = $this.find('.' + opts.messageClass).length === 0;
					$this.data('waitingForMessages', $this.data('waitingForMessages') - 1);
					var msg = snapshot.val();
					msg.created = opts.formatDate(new Date(msg.created));
					msg.message = preMerge(msg.message, opts);
					msg.message = opts.formatMessage(msg.message);

					if (!message($this, snapshot.key(), opts).length) {
						var contents = opts.mergeTemplate(opts.template, opts.fillModel(msg));
						contents = postMerge(contents, opts);
						var newEle = $(contents).addClass(opts.messageClass).
							addClass(opts.messageClass + '-' + snapshot.key()).data({
								messageId: snapshot.key(),
								message: msg,
								priority: snapshot.getPriority()
							}).hide();
						
						if (opts.editButtons && messageKeys().indexOf(snapshot.key()) >= 0) {
							newEle.append($(opts.editButtons));
						}

						if (prevKey) {
							message($this, prevKey, opts).after(newEle);
						} else {
							$this.prepend(newEle);
						}

						newEle.trigger('firesideMessageAdded');

						if (prevKey || veryFirst) {
							newEle.show();
						} else {
							opts.showMessage(newEle);
						}
					}
			   	});

				loadMessages(ref, $this, opts);
    		});
    	}
	});
}) (jQuery);