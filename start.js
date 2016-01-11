var brooklyn = require('./index');
var credentials = require('./credentials');
var clc = require('cli-color')

var valid = clc.green.bold('✔');
var bad = clc.red.bold('✘');

var options = {
	delay: 15,
	priority: [],
	file: 'sergserg'
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
	brooklyn.all('update', options);
});

brooklyn.on('newProcess', function(flowerPower) {
	console.log(flowerPower.uuid + ": " + flowerPower.lastProcess);
});

brooklyn.on('info', function(info) {
	console.log('INFO:', info.message);
});

brooklyn.on('error', function(error) {
	console.log('ERROR:', error.message);
});
