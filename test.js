var Bridge = require('./lib/FlowerBridge');
var credentials = require('./credentials');
var clc = require('cli-color')

var brooklyn = new Bridge();
var valid = clc.green.bold('✔');
var bad = clc.red.bold('✘');

var options = {
	delay: 15,
	priority: [],
};

brooklyn.loginToApi(credentials);

brooklyn.on('login', function() {
	console.log(valid, clc.green('Login!'));
	brooklyn.automatic(options);
});

brooklyn.on('newProcess', function(flowerPower) {
	if (flowerPower.lastProcess == 'Searching') {
		process.stdout.write(flowerPower.uuid + " ");
	}
	else if (flowerPower.lastProcess == 'Disconnected') {
		if (flowerPower.process[1] == 'Updated') console.log(valid);
		else if (flowerPower.process[1] == 'No update required') console.log(valid + ' -> ' + flowerPower.process[1]);
		else console.log(bad + ' -> ' + flowerPower.process[1]);
	}
	else if (flowerPower.lastProcess == 'Not found') {
		console.log(bad + ' -> Not found');
	}
});

brooklyn.on('info', function(info) {
	console.log(info.message);
});

brooklyn.on('error', function(error) {
	console.log(error.message);
});

