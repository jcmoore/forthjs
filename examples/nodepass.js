// Must be run directly from current working directory (i.e. "node nodepass.js").
var Forth = require("../forth"),
	fs = require("fs"),
	src = "../forth.js",
	faultRatio = 3;

src += (Date.now() % faultRatio) ? "" : "_NOT_A_VALID_FILE";
Forth.node(fs, fs.readFile, src, "utf8").last(function (callforth, err, source) {
	var problems;
	if (err) {
		problems = problems || [];
		problems.push(err);
	}

	if (source) {
		source = source.replace(/;/g, "");
	}

	callforth(err, problems, source);
}).last(function (callforth, err, problems, source) {
	var path = "../README.md";
	path += (Date.now() % faultRatio) ? "" : "_NOT_A_VALID_FILE";
	fs.readFile( path, "utf8", function (err, readme) {
		if (err) {
			problems = problems || [];
			problems.push(err);
		}
		callforth(err, problems, source, readme);
	});
}).last(function (callforth, err, problems, source, readme) {
	var path = "../LICENSE";
	path += (Date.now() % faultRatio) ? "" : "_NOT_A_VALID_FILE";
	fs.readFile( path, "utf8", function (err, license) {
		if (err) {
			problems = problems || [];
			problems.push(err);
		}
		console.log(readme+"\n");
		console.log(" - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - \n");
		console.log(license+"\n");
		console.log(" - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - \n");
		console.log(source+"\n");
		console.log(" - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - \n");
		console.log(problems+"\n");

		callforth(problems, source, readme, license);
	});
});