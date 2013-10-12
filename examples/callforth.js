var Forth = require("../forth"),
	forth = Forth.go ( function start (callforth) {

		var result = [1, 2, 3];

		callforth.report(null, Date.now());
		callforth.report(null, Date.now());
		callforth.report(null, Date.now());

		if (Date.now() % 3) {
			callforth ( null, result );
			result.push(4); // NOTE: callforth is delayed
		} else {
			callforth ( new Error("bad"), null );
		}

	} );

forth.good ( function success (callforth, data) {
	console.log(["success", data]);
} ).bad( function die (err, callforth) {
	console.log(["die", err]);
	callforth(err, [5, 6, 7, 8]);
}).last( function after (callforth, err, data) {
	console.log(["after", err, data]);
});

forth.bad ( function fail (err, callforth) {
	console.log(["fail", err]);
} );

forth.status( function progress (callforth, warn, info) {
	console.log(["progress", warn, info]);
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
