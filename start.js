var clc = require('cli-color');
var Bridge = require('./index');
var figures = require('figures');
var credentials = require('./credentials');

var valid = clc.green.bold(figures.tick);
var bad = clc.red.bold(figures.cross);

var brooklyn = new Bridge();

var options = {
	delay: 15,
	priority: [],
};

credentials['auto-refresh'] = true;
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
	console.log("[" + flowerPower.lastDate.toString().substr(4, 20) + "]:", flowerPower.uuid + ": " + flowerPower.lastProcess);
});

brooklyn.on('info', function(info) {
	console.log(clc.yellow("[" + info.date.toString().substr(4, 20) + "]:", info.message));
});

brooklyn.on('newState', function(state) {
	console.log(clc.xterm(0)("[" + new Date().toString().substr(4, 20) + "]:", state));
});

brooklyn.on('error', function(error) {
	console.log(clc.red("[" + error.date.toString().substr(4, 20) + "]:", error.message));
});
