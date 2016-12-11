const clc = require('cli-color');
const Bridge = require('./index');
const figures = require('figures');
const credentials = require('./credentials');

const valid = clc.green.bold(figures.tick);
const bad = clc.red.bold(figures.cross);

const brooklyn = new Bridge();

const options = {
	delay: process.argv[2] || 15,
	priority: [],
	filter: (fp) => true
};

credentials['auto-refresh'] = true;
brooklyn.loginToApi(credentials, (err) => {
	if (err) {
		console.error(err.toString());
		process.exit(1);
	}
});

brooklyn.on('login', () => {
	console.log(valid, clc.green('Login!'));
	brooklyn.automatic(options);
});

brooklyn.on('newProcess',
	(flowerPower) => console.log("[" + flowerPower.lastDate.toString().substr(4, 20) + "]:", flowerPower.identifier + ": " + flowerPower.lastProcess));

brooklyn.on('info',
	(info) => console.log(clc.yellow("[" + info.date.toString().substr(4, 20) + "]:", info.message)));

brooklyn.on('newState',
	(state) => console.log(clc.xterm(0)("[" + new Date().toString().substr(4, 20) + "]:", state)));

brooklyn.on('error',
	(error) => console.log(clc.red("[" + error.date.toString().substr(4, 20) + "]:", error.message)));
