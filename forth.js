var noforth,
	Forth = module.exports = function (method) {
		// The provided-method that accepts a callforth-method as a (1st or 2nd) parameter.
		this ["in()"] = method;

		// The following are all lazily loaded:

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
		// Will contain a list of forths to send status() signals.
		this ["status[]"] = null;
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
		params.unshift(0);
	}

	this["param[]"] = params;

	// Set the time-to-live -- to allow garbage collection.
	setTimeout(function () {
		if (this["param[]"] === params) {
			this["param[]"] = null;
		}
	}, 0);

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
		var params;
		var erred;
		var list;
		var count;
		var index;
		var field;
		var forth;
		var method;

		if (cache) {
			cache = null; // callforth should only respond meaningfully to invocation once.
			args = self["arg[]"] = Array.prototype.slice.call(arguments);
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
					method.apply(null, params);
				}
				params[field] = args[field];
			}

			if (erred) { // Invoke all bad() handlers as necessary.
				list = self["good[]"];
				if (list) {
					count = list.length;
					for (index = 0; index < count; index++) {
						// Pass the bad() signal down the good() part of the tree.
						forth = list[index];
						forth.come().apply(null, args);
					}
				}
			}

			list = self["last[]"];
			field = 0; // The callforth-method will be the first parameter.
			if (list) {
				count = list.length;

				if (count > 0) {
					// Reserve space for the callforth-method -- other parameters follow.
					params.unshift(null);
				}

				for (index = 0; index < count; index++) {
					// Invoke each forth's provided-method.
					forth = list[index];
					// Place each forth's callforth-method in the correct argument position.
					params[field] = forth.come();
					method = forth["in()"];
					method.apply(null, params);
				}
				params[field] = null;
				self.make( params );
			}

			self["good[]"] = null;
			self["bad[]"] = null;
			self["last[]"] = null;
			self["status[]"] = null;
		}
	};

	// The report-method -- invoked to send status() signals to relevant listeners.
	call.report = function () {
		var self = cache;
		var args;
		var list;
		var count;
		var index;
		var field;
		var forth;
		var method;

		if (self && (list = self["status[]"])) {
			field = 0;
			count = list.length;
			args = Array.prototype.slice.call(arguments);

			if (count > 0) {
				// Reserve space for the callforth-method -- other parameters follow.
				args.unshift(null);
			}

			for (index = 0; index < count; index++) {
				// Invoke each forth's provided-method.
				forth = list[index];
				// Place each forth's callforth-method in the correct argument position.
				args[field] = forth.come();
				method = forth["in()"];
				method.apply(null, args);
			}
			args[field] = null;
		}
	};

	return call;
};

// Create a forth to handle a good() signal.
Forth.prototype.good = function ( method ) {
	var args = this["arg[]"]; // null unless this forth has already been callforth()ed.
	var forth = new Forth(method);

	if (!args) {
		// callforth() has not yet been executed -- store the new forth.
		(this ["good[]"] || (this ["good[]"] = [])).push(forth);
	} else if (!args[0]) {
		// callforth() has already been executed with no error -- callforth() the new forth.
		args[0] = forth.come();
		method.apply(null, args);
		args[0] = null;
	}

	return forth;
};

// Create a forth to handle a good() signal.
Forth.prototype.bad = function ( method ) {
	var args = this["arg[]"]; // null unless this forth has already been callforth()ed.
	var forth = new Forth(method);

	if (!args) {
		// callforth() has not yet been executed -- store the new forth.
		(this ["bad[]"] || (this ["bad[]"] = [])).push(forth);
	} else if (args[0]) {
		// callforth() has already been executed with an error -- callforth() the new forth.
		args[1] = forth.come();
		method.apply(null, args);
		args[1] = null;
	}

	return forth;
};

// Create a forth to handle either a good() or bad() signal.
Forth.prototype.last = function ( method ) {
	var params = this.make(); // null unless this forth has already been callforth()ed.
	var forth = new Forth(method);

	if (!params) {
		// callforth() has not yet been executed -- store the new forth.
		(this ["last[]"] || (this ["last[]"] = [])).push(forth);
	} else {
		// callforth() has already been executed -- callforth() the new forth.
		params[0] = forth.come();
		method.apply(null, params);
		params[0] = null;
	}

	return forth;
};

// Create a forth to handle a status() signal.
Forth.prototype.status = function ( method ) {
	var args = this["arg[]"]; // null unless this forth has already been callforth()ed.
	var forth;

	if (!args) {
		// callforth() has not yet been executed -- store the new forth.
		forth = new Forth(method);
		(this ["status[]"] || (this ["status[]"] = [])).push(forth);
	} else {
		// callforth() has already been executed -- no more status signals can be sent.
		forth = noforth;
	}

	return forth;
};

// noforth is a mechanism to keep status() invocations from consuming memory unnecessarily.
// (i.e. when no more status() signals will be sent)
noforth = new Forth();
noforth["arg[]"] = [];
noforth["in()"] = noforth["out()"] = function () {};
noforth.good = noforth.bad = noforth.status = function () { return noforth; };

// Start a forth-chain using a provided-method.
Forth.go = function ( method ) {
	var args = Array.prototype.slice.call(arguments);
	var forth = new Forth(method);

	args[0] = forth.come();
	method.apply(null, args);

	return forth;
};

// Start a forth-chain using a node.js-style invocation.
// (the callback given to the node.js-style invocation will kick-off the forth-chain)
Forth.node = function (target, method) {
	var forth = new Forth();
	var args = Array.prototype.slice.call(arguments, 2);

	args.push(forth.come());
	method.apply(target, args);

	return forth;
};
