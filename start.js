var Bridge = require('./index');
var credentials = require('./credentials');
var clc = require('cli-color');

var brooklyn = new Bridge(credentials.url);
delete credentials.url;

var valid = clc.green.bold('✔');
var bad = clc.red.bold('✘');

var options = {
	delay: 15,
	type: [],
	priority: ['Parrot pot a0ad'],
};

credentials['auto-refresh'] = false;
brooklyn.loginToApi(credentials, function(err) {
	if (err) {
		console.error(err.toString());
		process.exit(1);
	}
});

brooklyn.on('login', function() {
	console.log(valid, clc.green('Login!'));
	brooklyn.automatic(options);
});

brooklyn.on('newProcess', function(flowerPower) {
	console.log(flowerPower.name + ": " + flowerPower.lastProcess);
});

brooklyn.on('info', function(info) {
	console.log(info.message);
});

brooklyn.on('error', function(error) {
	console.log(error.message);
});
