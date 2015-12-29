var brooklyn = require('./index');
var credentials = require('./credentials');
var clc = require('cli-color')

var valid = clc.green.bold('✔');
var bad = clc.red.bold('✘');

var options = {
	delay: 15,
	priority: [],
};

brooklyn.loginToApi(credentials);

brooklyn.on('login', function() {
	console.log(valid, clc.green('Login!'));
	brooklyn.automatic()
});

brooklyn.on('newProcess', function(flowerPower) {
	console.log(flowerPower.uuid + ": " + flowerPower.lastProcess);
});


brooklyn.on('info', function(info) {
	console.log(info.message);
});

brooklyn.on('error', function(error) {
	console.log(error.message);
});
