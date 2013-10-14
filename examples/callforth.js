var Forth = require("../forth"),
	forth = Forth.head ( function start (callforth) {

		var result = [1, 2, 3];

		callforth.tell(null, Date.now());
		callforth.tell(null, Date.now());
		callforth.tell(null, Date.now());

		if (Date.now() % 3) {
			callforth ( null, result );
			result.push(4); // NOTE: callforth is delayed
		} else {
			callforth ( new Error("bad"), null );
		}
			console.log(["hence"]);

	} );

forth.good ( function success (callforth, data) {
	console.log(["success", data]);
} ).bad( function die (err, callforth) {
	console.log(["die", err]);
	callforth(err, [5, 6, 7, 8]);
}).last( function after (callforth, err, data) {
	console.log(["after", err, data]);
});

forth.good ( function maybe (callforth, data) {
	console.log(["maybe", data]);
	callforth ( null, data );
}).last ( function always (callback, err, data) {
	console.log(["always", err, data]);
});

forth.bad ( function fail (err, callforth) {
	console.log(["fail", err]);
} );

forth.heard( function progress (callforth, warn, info) {
	console.log(["progress", warn, info]);
} );

forth.echo().heard( function silent (callforth, warn, info) {
	console.log(["silent", warn, info]);
} ).last( function ugly (callforth, a, b, c) {
	console.log(["ugly", arguments.length, a, b, c]);
} );

forth = forth.pass ();

forth.bad ( function either (err, callforth) {
	console.log(["either", err]);
});

forth.good ( function or (callforth, data) {
	console.log(["or", data]);
}).bad ( function not (err, callback) {
	console.log(["not", err]);
});
