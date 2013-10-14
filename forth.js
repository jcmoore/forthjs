( function ( target, exporter ) {
	if ( typeof exports == "object" && typeof module == "object" ) {
		exporter ( exports, target );
	} else if ( typeof define == "function" && define.amd ) {
		define ( ["exports"], function (exports) {
			return exporter ( exports, target );
		} );
	} else {
		exporter ( target.Forth || ( target.Forth = {} ), target );
	}
} ) ( this, function (exports, root) {

var run = function ( method, delay ) { return method(); },

	// null or number indicating how long forth propogation should be delayed.
	delay = 0,
	// The method used to propogate forths.
	plan = (delay !== null) ? setTimeout : run,
	// null or number indicating how long transient param[] exists.
	transientTimeToLive = 0,
	// The method managing transient persistence.
	shedule = (transientTimeToLive !== null) ? setTimeout : run,
	
	// Filler is a special/unique value used as an argument placeholder to improve memory reuse.
	Filler = {},

	// nim is a mechanism to keep heard() invocations from consuming memory unnecessarily.
	// (i.e. when no more signals of a certain type will be sent)
	nim, // Assigned below.
	
	bitOffset = 16,

	// The skip setting permits breaking the chain of "bad" signal passing.
	// (i.e. down the "good" side of the tree)
	BitSkip = 1 << bitOffset++,

	// The eventual setting permits delayed silencing -- this keeps the "stack-depth" low.
	// (however, unexpected heard() signal behavior may be experienced)
	BitEventual = 1 << bitOffset++,

	// The rebel setting permits ignoring commands to abort "heard" signal passing.
	// (i.e. down the "heard" tree)
	BitRebel = 1 << bitOffset++,

	// The lag setting indicates that any broadcast tell() signals should be delayed.
	BitLag = 1 << bitOffset++,
	


	commonArgumentCount = 4, // ( options, bitmask, target, method )

	// A common good() signal handler that invokes a "good" callforth passing all other parameters.
	relay = function () {
		var field = 0;
		var callforth = arguments[field];
		var target = this;
		var result;

		arguments[0] = null; // Never errs.
		result = callforth.apply(target, arguments);
		arguments[0] = callforth;

		return result;
	},

	// A common told() signal handler that invokes a callforth "tell" passing all other parameters.
	resound = function ( callforth ) {
		var field = 0;
		var args = Array.prototype.slice.call(arguments, 1);
		var target = this;
		var result;

		result = callforth.tell.apply(target, args);

		return result;
	},

	// Place forth's callforth-method in the correct argument position and invoke provided-method.
	launch = function (forth, field, args, target, method, repeatable) {
		var callforth = args[field] = forth.come();
		method.apply(target, args);
		if (repeatable !== true) {
			// Force last() signal handlers to respond.
			// (even if no good() or bad() signals fired -- an "ugly" state)
			callforth();
		}
	},

	// Prepare a launch -- with cleanup.
	sequence = function (forth, field, args, target, method) {
		plan (function () {
			launch(forth, field, args, target, method);
			args[field] = Filler;
		}, delay);
	},

	backfire = function (forth, args, target) {
		forth.come().apply(target, args);
	},

	ricochet = function (forth, args, target) {
		plan (function () {
			backfire(forth, args, target);
		}, delay);
	},
 
	Forth = module.exports = function ( options, bitmask, target, method ) {

		var vars = arguments.length;

		if (vars < commonArgumentCount) {
			method = arguments[--vars];
			target = arguments[--vars];
			bitmask = arguments[--vars];
			options = arguments[--vars];
		}

		// The provided-method that accepts a callforth-method as a (1st or 2nd) parameter.
		if (method) {
			this ["in()"] = method;
		}

		// A ("this") context with which to apply the provided-method.
		if (target) {
			this ["as?"] = target;
		}

		// A set of configuration data encoded in a set of bits.
		if (bitmask) {
			this ["bits?"] = bitmask;
		}

		// A set of configuration data supplied as key-value pairs.
		if (options) {
			this ["opts[]"] = options;
		}

		// The following are all lazily loaded (and technically need not be instantiated):
		return;

		// Will contain the callforth-method.
		this ["out()"] = null;
		// Will cache the array of arguments when callforth() is invoked.
		this ["arg[]"] = null;
		// A transient list reflecting this["arg[]"] with additional space.
		this ["param[]"] = null;
		// Will contain a list of forths to send good() signals.
		this ["good[]"] = null;
		// Will contain a list of forths to send bad() signals.
		this ["bad[]"] = null;
		// Will contain a list of forths to send either good() or bad() signals.
		this ["last[]"] = null;
		// Will contain a list of forths to send heard() signals.
		this ["heard[]"] = null;

	};

// Lazily load -- and set time-to-live for -- the transient extended list of arguments.
Forth.prototype.make = function (params) {
	var args;

	if (!params) {

		params = this["param[]"];

		if (params) {
			// params already established (though transient), use the existing value.
			return params;
		}

		args = this["arg[]"];

		if (!args) {
			// callforth() has not yet been invoked -- no way to create params.
			return null;
		}

		params = args.slice();
		// Add extra space -- just for a callforth-method in most cases.
		params.unshift(Filler);
	}

	this["param[]"] = params;

	// Set the time-to-live -- to allow garbage collection.
	shedule (function () {
		if (this["param[]"] === params) {
			this["param[]"] = null;
		}
	}, transientTimeToLive);

	return params;
};

// Lazily load the callforth-method.
Forth.prototype.come = function () {
	var cache = this;
	var call = this ["out()"];

	if (call) {
		// The callforth has already been loaded.
		return call;
	}

	// The callforth-method -- invoked to pass control to successive forth instances.
	call = this ["out()"] = function () {
		var self = cache;
		var args;
		var bitfield;
		var inconsistently;

		if (cache) {
			cache = null; // callforth should only respond meaningfully to invocation once.
			args = self["arg[]"] = Array.prototype.slice.call(arguments);

			bitfield = self["bits?"];

			// Silence immediately if eventual consistency is not allowed.
			if (!(inconsistently = (bitfield & BitEventual))) {
				self.silence();
			}

			plan (function () {

				var params;
				var erred;
				var list;
				var count;
				var index;
				var field;
				var forth;
				var propogate;

				// Silence eventually if eventual consistency is allowed.
				if (inconsistently) {
					self.silence();
				}

				params = args.slice();
				
				if ((erred = params[0])) { // The first argument indicates errors by convention.
					list = self["bad[]"];
					field = 1;
				} else if (params.length > 0) { // Not "ugly", as long as there were arguments.
					list = self["good[]"];
					field = 0;
				} else { // It was "ugly".

				}

				if (list) {
					count = list.length;
					for (index = 0; index < count; index++) {
						// Invoke each forth's provided-method.
						forth = list[index];
						launch(forth, field, params, forth["as?"], forth["in()"]);
					}
					params[field] = args[field];
				}

				propogate = erred && !( bitfield & BitSkip );

				if (propogate) {
					// Invoke all bad() and last() handlers as necessary.
					list = self["good[]"];
					if (list) {
						count = list.length;
						for (index = 0; index < count; index++) {
							forth = list[index];
							// Pass the bad() signal down the good() part of the tree.
							backfire(forth, args, (this !== root ? this : self));
						}
					}
				}

				list = self["last[]"];
				field = 0; // The callforth-method will be the first parameter.
				if (list) {
					count = list.length;

					if (count > 0) {
						// Reserve space for the callforth-method -- other parameters follow.
						params.unshift(Filler);
					}

					for (index = 0; index < count; index++) {
						// Invoke each forth's provided-method.
						forth = list[index];
						launch(forth, field, params, forth["as?"], forth["in()"]);
					}
					params[field] = Filler;
					self.make( params );
				}

				self["good[]"] = null;
				self["bad[]"] = null;
				self["last[]"] = null;
			}, delay);
		}
	};

	// The tell-method -- invoked to send heard() signals to relevant listeners.
	// (Supports invocation with Forth.Filler as first argument for slight performance improvement)
	call.tell = function () {
		var self = cache;
		var invoked;
		var args;
		var bitfield;
		var inconsistently;
		var list;
		var count;
		var index;
		var field;
		var forth;
		var repeatable = true;

		if (self && self["heard[]"]) {
			field = 0;
			args = Array.prototype.slice.call(arguments);

			// Forward heard() signals immediately unless lag was specified.
			( ( self["bits?"] & BitLag ) ? plan : run ) (function () {

				if (!(list = self["heard[]"])) {
					return;
				}

				invoked = self["arg[]"];

				count = list.length;

				if (count > field &&
					args[field] !== Filler) {
					// Reserve space for the callforth-method -- other parameters follow.
					args.unshift(Filler);
				}

				for (index = 0; index < count; index++) {
					// Invoke each forth's provided-method.
					forth = list[index];

					bitfield = forth["bits?"];
					inconsistently = (self["bits?"] & BitEventual);

					// Do not send further heard() signals if callforth has been invoked.
					if (!invoked || inconsistently) {
						launch(forth, field, args, forth["as?"], forth["in()"], repeatable);
					}
				}
				args[field] = Filler;
			}, delay);
		}
	};

	return call;
};

// Prevent further heard() signal propocation as necessary
Forth.prototype.silence = function () {
	
	var list;

	if (list = this["heard[]"]) {
		this["heard[]"] = null;

		var count = list.length;
		var index;
		var forth;
		var callforth;
		
		for (index = 0; index < count; index++) {
			forth = list[index];
			// Rebels cannot be forced into silence, they must quiet themselves.
			if (!(forth["bits?"] & BitRebel)) {
				callforth = forth.come();
				callforth(); // Potentially "ugly".
			}
		}
	}

};

// Create a forth to handle a good() signal.
Forth.prototype.good = function ( options, bitmask, target, method ) {

	var vars = arguments.length;

	if (vars < commonArgumentCount) {
		method = arguments[--vars];
		target = arguments[--vars];
		bitmask = arguments[--vars];
		options = arguments[--vars];
	}

	var args = this["arg[]"]; // null unless this forth has already been callforth()ed.
	var forth;
	var field = 0;

	if (!args) {
		// callforth() has not yet been executed -- store the new forth.
		forth = new Forth( options, bitmask, target, method );
		(this ["good[]"] || (this ["good[]"] = [])).push(forth);
	} else if (args.length < 1) {
		return nim; // NOTE: here is a case where a trailing last() may not occur!
	} else if (!args[0]) {
		// callforth() has already been executed with no error -- callforth() the new forth.
		forth = new Forth( options, bitmask, null, null );
		sequence(forth, field, args, target, method);
	} else {
		forth = new Forth( options, bitmask, null, null );
		ricochet(forth, args, target);
	}

	return forth;
};

// Create a forth to handle a bad() signal.
Forth.prototype.bad = function ( options, bitmask, target, method ) {

	var vars = arguments.length;

	if (vars < commonArgumentCount) {
		method = arguments[--vars];
		target = arguments[--vars];
		bitmask = arguments[--vars];
		options = arguments[--vars];
	}

	var args = this["arg[]"]; // null unless this forth has already been callforth()ed.
	var forth;
	var field = 1;

	if (!args) {
		// callforth() has not yet been executed -- store the new forth.
		forth = new Forth( options, bitmask, target, method );
		(this ["bad[]"] || (this ["bad[]"] = [])).push(forth);
	} else if (args.length < 1) {
		return nim; // NOTE: here is a case where a trailing last() may not occur!
	} else if (args[0]) {
		// callforth() has already been executed with an error -- callforth() the new forth.
		forth = new Forth( options, bitmask, null, null );
		sequence(forth, field, args, target, method);
	} else {
		forth = nim;
	}

	return forth;
};

Forth.prototype.ugly = function ( options, bitmask, target, method ) {
	return nim;
};

// Create a forth to handle either a good() or bad() signal.
Forth.prototype.last = function ( options, bitmask, target, method ) {

	var vars = arguments.length;

	if (vars < commonArgumentCount) {
		method = arguments[--vars];
		target = arguments[--vars];
		bitmask = arguments[--vars];
		options = arguments[--vars];
	}

	var params = this.make(); // null unless this forth has already been callforth()ed.
	var forth;
	var field = 0;

	if (!params) {
		// callforth() has not yet been executed -- store the new forth.
		forth = new Forth( options, bitmask, target, method );
		(this ["last[]"] || (this ["last[]"] = [])).push(forth);
	} else {
		// callforth() has already been executed -- callforth() the new forth.
		forth = new Forth( options, bitmask, null, null );
		sequence(forth, field, params, target, method);
	}

	return forth;
};

// Create a good() forth that prevents bad() signals from propogating.
// (i.e. bad() signals will not be passed down the "good" side of the tree)
Forth.prototype.pass = function ( options, bitmask, target, method ) {

	var vars = arguments.length;

	if (vars < commonArgumentCount) {
		method = arguments[--vars];
		target = arguments[--vars];
		bitmask = arguments[--vars];
		options = arguments[--vars];
	}

	method = method || relay;
	bitmask = bitmask | BitSkip;

	var args = this["arg[]"]; // null unless this forth has already been callforth()ed.
	var forth;
	var field = 0;

	if (!args) {
		// callforth() has not yet been executed -- store the new forth.
		forth = new Forth( options, bitmask, target, method );
		(this ["good[]"] || (this ["good[]"] = [])).push(forth);
	} else if (args.length < 1) {
		return nim; // NOTE: here is a case where a trailing last() may not occur!
	} else if (!args[0]) {
		// callforth() has already been executed with no error -- callforth() the new forth.
		forth = new Forth( options, bitmask, null, null );
		sequence( forth, field, args, target, method );
	} else {
		forth = new Forth( options, bitmask, null, null );
		ricochet( forth, args, target );
	}

	return forth;
};

// Create a forth to handle a heard() signal.
Forth.prototype.heard = function ( options, bitmask, target, method ) {

	var vars = arguments.length;

	if (vars < commonArgumentCount) {
		method = arguments[--vars];
		target = arguments[--vars];
		bitmask = arguments[--vars];
		options = arguments[--vars];
	}

	var args = this["arg[]"]; // null unless this forth has already been callforth()ed.
	var forth;

	if (!args) {
		// callforth() has not yet been executed -- store the new forth.
		forth = new Forth( options, bitmask, target, method );
		(this ["heard[]"] || (this ["heard[]"] = [])).push(forth);
	} else {
		// callforth() has already been executed -- no more heard signals can be sent.
		forth = nim;
	}

	return forth;
};

// Create a forth to rebroadcast heard() signals with lag.
Forth.prototype.echo = function ( options, bitmask, target, method ) {

	var vars = arguments.length;

	if (vars < commonArgumentCount) {
		method = arguments[--vars];
		target = arguments[--vars];
		bitmask = arguments[--vars];
		options = arguments[--vars];
	}

	method = method || resound;
	bitmask = bitmask | BitLag;

	return Forth.prototype.heard.call ( this, options, bitmask, target, method );
};



nim = new Forth(null, null, null, null);
nim["arg[]"] = nim["param[]"] = [];
nim["in()"] = nim["out()"] = function () {};
nim.good = nim.bad = nim.ugly = nim.last = nim.heard = nim.echo = function () { return nim; };



// Start a forth-chain using a provided-method (first argument).
Forth.head = function () {
	var args = Array.prototype.slice.call(arguments);
	var field = 0;
	var method = args [field];
	var target = this;
	var forth = new Forth(null, null, null, null);

	sequence(forth, field, args, target, method);

	return forth;
};

// Start a forth-chain using a provided-method -- last argument.
// (slightly less performant than Forth.head -- use Forth.Filler for a slight improvement)
Forth.tail = function () {
	var args = Array.prototype.slice.call(arguments, 0, -1);
	var field = 0;
	var method = arguments [arguments.length - 1];
	var target = this;
	var forth = new Forth(null, null, null, null);

	if (args.length > field &&
		args[field] !== Filler) {
		args.unshift(Filler);
	}

	sequence(forth, field, args, target, method);

	return forth;
};

// Start a forth-chain using a node.js-style method -- first argument.
// (the callback given to the node.js-style invocation will kick-off the forth-chain)
Forth.evoke = function () {
	var forth = new Forth(null, null, null, null);
	var args = Array.prototype.slice.call(arguments);
	var count = args.length;
	var method = args[count - 1];
	var target = this;

	args[count - 1] = Filler;

	sequence(forth, count - 1, args, target, method);

	return forth;
};

// Start a forth-chain using a node.js-style method -- last argument.
// (the callback given to the node.js-style invocation will kick-off the forth-chain)
// (slightly less performant than Forth.evoke -- use Forth.Filler for a slight improvement)
Forth.invoke = function ( method ) {
	var forth = new Forth(null, null, null, null);
	var args = Array.prototype.slice.call(arguments, 1);
	var count = args.length;
	var target = this;

	if (args[count - 1] !== Filler) {
		args.push(Filler);
		count++;
	}

	sequence(forth, count - 1, args, target, method);

	return forth;
};

// Filler can be supplied in certain function invocations as an unused placeholder parameter.
// (this can lead to better memory reuse)
Forth.Filler = Filler;

// Make bitmask values publically available.
Forth.BitSkip = BitSkip;
Forth.BitEventual = BitEventual;
Forth.BitRebel = BitRebel;
Forth.BitLag = BitLag;

} );
