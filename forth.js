( function ( target, exporter ) {
	if ( typeof exports == "object" && typeof module == "object" ) {
		exporter ( exports );
	} else if ( typeof define == "function" && define.amd ) {
		define ( ["exports"], exporter );
	} else {
		exporter ( target.acorn || ( target.acorn = {} ) );
	}
} ) ( this, function (exports) {

var run = function ( method, delay ) { return method(); },

	delay = 0,
	plan = (delay !== null) ? setTimeout : run,
	transientTimeToLive = 0,
	shedule = (transientTimeToLive !== null) ? setTimeout : run,
	
	Filler = {},
	noforth,
	
	bitOffset = 16,

	// The skip setting permits breaking the chain of "bad" signal passing.
	// (i.e. down the "good" side of the tree)
	BitSkip = 1 << bitOffset++,

	BitLag = 1 << bitOffset++,

	// The trailing setting will cause the callforth-method to come from the last parameter.
	// (the default behavior is to expect the callforth-method as the first parameter)
	BitTrailing = 1 << bitOffset++,
	


	commonArgumentCount = 4, // ( target, method, bitmask, options )

	revar = function (vars) { // [ target, method, bitmask, options ]
		var count = vars.length;
		var result;
		var undefined;

		// Arguments may be omitted in accordance with the following rules:
		// R00 -- "target" must always be followed by a "method" (which may be null).
		// R01 -- "options" must always be preceded by a "bitmask" (which may be null).
		// R02 -- typeof "bitmask" must never be "function".
		// R03 -- prefer to "method" arguments to "options" arguments when type is ambiguous.

		if (count < commonArgumentCount) {
			if (count < 1) {
			} else if (typeof vars[0] !== "function") {
				// First argument is definitely the "target".
				// (see R00)
				// Second argument is probably the "method".
				// Third argument is probably the "bitmask".
			} else if (typeof vars[1] !== "function") { 
				// (see R01 & R02)
				// First argument is probably the "method".
				// Second argument is probably the "bitmask".
				// Third argument is probably the "options".
				result = new Array (2 + !!vars[1] + !!vars[2]);
				vars[2] && (result[3] = vars[2]);
				vars[1] && (result[2] = vars[1]);
				result[1] = vars[0];
				result[0] = undefined;
			} else { 
				// (see R01 & R02)
				// First argument is probably the "target".
				// Second argument is probably the "method".
				// Third argument is probably "bitmask".
			}
		}

		return result;
	},

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

	resound = function ( callforth ) {
		var field = 0;
		var args = Array.prototype.slice.call(arguments, 1);
		var target = this;
		var result;

		result = callforth.tell.apply(target, args);

		return result;
	},

	Forth = module.exports = function ( target, method, bitmask, options ) {

		var vars = revar(arguments);

		if (vars) {
			target = vars[0];
			method = vars[1];
			bitmask = vars[2];
			options = vars[3];
		}

		// A ("this") context with which to apply the provided-method.
		if (target) {
			this ["as?"] = target;
		}

		// The provided-method that accepts a callforth-method as a (1st or 2nd) parameter.
		if (method) {
			this ["in()"] = method;
		}

		if (bitmask) {
			this ["bits?"] = bitmask;
		}

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

		if (cache) {
			cache = null; // callforth should only respond meaningfully to invocation once.
			args = self["arg[]"] = Array.prototype.slice.call(arguments);

			plan (function () {

				var params;
				var erred;
				var list;
				var count;
				var index;
				var field;
				var forth;
				var method;

				params = args.slice();
				
				if ((erred = params[0])) { // The first argument indicates errors by convention.
					list = self["bad[]"];
					field = 1;
				} else {
					list = self["good[]"];
					field = 0;
				}

				if (list) {
					count = list.length;
					for (index = 0; index < count; index++) {
						// Invoke each forth's provided-method.
						forth = list[index];
						// Place each forth's callforth-method in the correct argument position.
						params[field] = forth.come();
						method = forth["in()"];
						method.apply(forth["as?"], params);
					}
					params[field] = args[field];
				}

				if (erred && !( self["bits?"] & BitSkip )) { // Invoke all bad() handlers as necessary.
					list = self["good[]"];
					if (list) {
						count = list.length;
						for (index = 0; index < count; index++) {
							// Pass the bad() signal down the good() part of the tree.
							forth = list[index];
							forth.come().apply(forth["as?"], args);
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
						// Place each forth's callforth-method in the correct argument position.
						params[field] = forth.come();
						method = forth["in()"];
						method.apply(forth["as?"], params);
					}
					params[field] = Filler;
					self.make( params );
				}

				self["good[]"] = null;
				self["bad[]"] = null;
				self["last[]"] = null;
				self["heard[]"] = null;
			}, delay);
		}
	};

	// The tell-method -- invoked to send heard() signals to relevant listeners.
	// (Supports invocation with Forth.Filler as first argument for slight performance improvement)
	call.tell = function () {
		var self = cache;
		var args;
		var list;
		var count;
		var index;
		var field;
		var forth;
		var method;

		if (self && (list = self["heard[]"])) {
			field = 0;
			count = list.length;
			args = Array.prototype.slice.call(arguments);

			// Forward heard() signals immediately unless lag was specified.
			( ( self["bits?"] & BitLag ) ? plan : run ) (function () {
				if (self["arg[]"]) {
					// Do not send further heard() signals if 
					return;
				}

				if (count > field &&
					args[field] !== Filler) {
					// Reserve space for the callforth-method -- other parameters follow.
					args.unshift(Filler);
				}

				for (index = 0; index < count; index++) {
					// Invoke each forth's provided-method.
					forth = list[index];
					// Place each forth's callforth-method in the correct argument position.
					args[field] = forth.come();
					method = forth["in()"];
					method.apply(forth["as?"], args);
				}
				args[field] = Filler;
			}, delay);
		}
	};

	return call;
};

// Create a forth to handle a good() signal.
Forth.prototype.good = function ( target, method, bitmask, options ) {

	var vars = revar(arguments);

	if (vars) {
		target = vars[0];
		method = vars[1];
		bitmask = vars[2];
		options = vars[3];
	}
	
	var args = this["arg[]"]; // null unless this forth has already been callforth()ed.
	var forth;
	var field = 0;

	if (!args) {
		// callforth() has not yet been executed -- store the new forth.
		forth = new Forth( target, method, bitmask, options );
		(this ["good[]"] || (this ["good[]"] = [])).push(forth);
	} else if (!args[0]) {
		forth = new Forth( null, null, bitmask, options );
		plan (function () {
			// callforth() has already been executed with no error -- callforth() the new forth.
			args[field] = forth.come();
			method.apply(target, args);
			args[field] = null;
		}, delay);
	}

	return forth;
};

// Create a forth to handle a bad() signal.
Forth.prototype.bad = function ( target, method, bitmask, options ) {

	var vars = revar(arguments);

	if (vars) {
		target = vars[0];
		method = vars[1];
		bitmask = vars[2];
		options = vars[3];
	}
	
	var args = this["arg[]"]; // null unless this forth has already been callforth()ed.
	var forth;
	var field = 1;

	if (!args) {
		// callforth() has not yet been executed -- store the new forth.
		forth = new Forth( target, method, bitmask, options );
		(this ["bad[]"] || (this ["bad[]"] = [])).push(forth);
	} else if (args[0]) {
		forth = new Forth( null, null, bitmask, options );
		plan (function () {
			// callforth() has already been executed with an error -- callforth() the new forth.
			args[field] = forth.come();
			method.apply(target, args);
			args[field] = null;
		}, delay);
	}

	return forth;
};

// Create a forth to handle either a good() or bad() signal.
Forth.prototype.last = function ( target, method, bitmask, options ) {

	var vars = revar(arguments);

	if (vars) {
		target = vars[0];
		method = vars[1];
		bitmask = vars[2];
		options = vars[3];
	}
	
	var params = this.make(); // null unless this forth has already been callforth()ed.
	var forth;

	if (!params) {
		// callforth() has not yet been executed -- store the new forth.
		forth = new Forth( target, method, bitmask, options );
		(this ["last[]"] || (this ["last[]"] = [])).push(forth);
	} else {
		forth = new Forth( null, null, bitmask, options );
		plan (function () {
			// callforth() has already been executed -- callforth() the new forth.
			params[0] = forth.come();
			method.apply(target, params);
			params[0] = Filler;
		}, delay);
	}

	return forth;
};

// Create a good() forth that prevents bad() signals from propogating.
// (i.e. bad() signals will not be passed down the "good" side of the tree)
Forth.prototype.pass = function () {
	var args = this["arg[]"]; // null unless this forth has already been callforth()ed.
	var method = relay;
	var target = null;
	var bitmask = ( BitSkip );
	var options = null;
	var forth;
	var field = 0;

	if (!args) {
		// callforth() has not yet been executed -- store the new forth.
		forth = new Forth(target, method, bitmask, options);
		(this ["good[]"] || (this ["good[]"] = [])).push(forth);
	} else if (!args[0]) {
		forth = new Forth(target, method, bitmask, options);
		plan (function () {
			// callforth() has already been executed with no error -- callforth() the new forth.
			args[field] = forth.come();
			method.apply(target, args);
			args[field] = null;
		}, delay);
	}

	return forth;
};

// Create a forth to handle a heard() signal.
Forth.prototype.heard = function ( target, method, bitmask, options ) {

	var vars = revar(arguments);

	if (vars) {
		target = vars[0];
		method = vars[1];
		bitmask = vars[2];
		options = vars[3];
	}
	
	var args = this["arg[]"]; // null unless this forth has already been callforth()ed.
	var forth;

	if (!args) {
		// callforth() has not yet been executed -- store the new forth.
		forth = new Forth(target, method, bitmask, options);
		(this ["heard[]"] || (this ["heard[]"] = [])).push(forth);
	} else {
		// callforth() has already been executed -- no more heard signals can be sent.
		forth = noforth;
	}

	return forth;
};

// Create a forth to rebroadcast heard() signals with lag.
Forth.prototype.echo = function ( target, method, bitmask, options ) {

	var vars = revar(arguments);

	if (vars) {
		target = vars[0];
		method = vars[1];
		bitmask = vars[2];
		options = vars[3];
	}
	
	method = method || resound;
	bitmask = bitmask | BitLag;

	return Forth.prototype.heard.call ( this, target, method, bitmask, options );
};

// noforth is a mechanism to keep heard() invocations from consuming memory unnecessarily.
// (i.e. when no more heard() signals will be sent)
noforth = new Forth(null, null, null, null);
noforth["arg[]"] = [];
noforth["in()"] = noforth["out()"] = function () {};
noforth.good = noforth.bad = noforth.heard = function () { return noforth; };



// Start a forth-chain using a provided-method (first argument).
Forth.head = function () {
	var args = Array.prototype.slice.call(arguments);
	var field = 0;
	var method = args [field];
	var target = this;
	var forth = new Forth(null, null, null, null);

	plan (function () {
		args[field] = forth.come();
		method.apply(target, args);
		args[field] = null;
	}, delay);

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

	plan (function () {
		if (args.length > field &&
			args[field] !== Filler) {
			args.unshift(Filler);
		}
		args[field] = forth.come();
		method.apply(target, args);
		args[field] = Filler;
	}, delay);

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

	plan (function () {
		args[count - 1] = forth.come();
		method.apply(target, args);
		args[count - 1] = Filler;
	}, delay);

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

	plan (function () {
		if (args[count - 1] !== Filler) {
			args.push(Filler);
			count++;
		}
		args[count - 1] = forth.come();
		method.apply(target, args);
		args[count - 1] = Filler;
	}, delay);

	return forth;
};

Forth.Filler = Filler;

Forth.BitSkip = BitSkip;
Forth.BitLag = BitLag;

} );
