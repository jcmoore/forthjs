var Forth = require("../forth"),
	forth = Forth.go ( function start (callforth) {

		setTimeout(function () {
			callforth.report(null, Date.now());
			callforth.report(null, Date.now());
			callforth.report(null, Date.now());

			if (Date.now() % 3) {
				callforth ( null, [1, 2, 3] );
			} else {
				callforth ( new Error("bad"), null );
			}
		}, 0);

	} );

forth.good ( function success (callforth, data) {
	console.log(["success", data]);
} ).bad( function die (err, callforth) {
	console.log(["die", err]);
	callforth.apply(null, arguments);
}).last( function end (callforth, err, data) {
	console.log(["end", err, data]);
});

forth.bad ( function fail (err, callforth) {
	console.log(["fail", err]);
} );

forth.status( function progress (callforth, warn, info) {
	console.log(["progress", warn, info]);
} );