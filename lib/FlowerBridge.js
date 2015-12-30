var SyncFP = require('./SyncFP');
var TaskFP = require('./TaskFP');
var FlowerPowerApi = require('flower-power-api');
var helpers = require('./helpers');
var util = require('util');
var async = require('async');
var EventEmitter = require('events');
var clc = require('cli-color');
var Chance = require('chance');
var deasync = require('deasync');
var chance = new Chance();

function FlowerBridge() {
	EventEmitter.call(this);
	this._state = 'off';
	this.user = null;
	this.api = new FlowerPowerApi();
	this.q = null;
	this.initBridge();
};

util.inherits(FlowerBridge, EventEmitter);

FlowerBridge.prototype.initBridge = function() {
	var self = this;

	self.q = async.queue(function(task, callbackNext) {
		task.startAction(task.uuid, task.options, callbackNext);
	}, 1);
};

FlowerBridge.prototype.loginToApi = function(credentials, callback) {
	var self = this;

	this.api.login(credentials, function(err, token) {
		if (!err) self.emit('login', token);
		if (typeof callback != 'undefined') callback(err, token);
	});
};

FlowerBridge.prototype.getState = function() {
	return (this._state);
};

FlowerBridge.prototype.getUser = function(callback) {
	var self = this;

	async.parallel({
		garden: function(callback) {
			self.api.getGarden(function(err, garden) {
				callback(err, garden);
			});
		},
		userConfig: function(callback) {
			self.api.getProfile(function(err, config) {
				callback(err, config);
			});
		},
	}, function(error, results) {
		var user = self.api.concatJson(results.userConfig, results.garden);
		self.user = user;
		callback(error, user);
	});
};

FlowerBridge.prototype.info = function(message) {
	this.emit('info', {
		message: message,
		date: new Date()
	});
};

FlowerBridge.prototype.error = function(message) {
	this.emit('error', {
		message: message,
		date: new Date()
	});
};

FlowerBridge.prototype.proc = function(flowerPower) {
	this.emit('newProcess', flowerPower);
};

FlowerBridge.prototype.stop = function () {
	this.emit('stop');
};

FlowerBridge.prototype.state = function(state) {
	this._state = state;
	this.emit('newState', state);
};

FlowerBridge.prototype.automatic = function(options) {
	var self = this;
	var delay = 15;

	if (typeof options != 'undefined' && typeof options['delay'] != 'undefinded') {
		delay = options['delay'];
	}
	self.info('New process every ' + delay + ' minutes');
	self.syncAll(options);
	setInterval(function() {
		self.syncAll(options);
	}, delay * 60 * 1000);
};

FlowerBridge.prototype.syncAll = function(options) {
	var self = this;
	var pushed = false;

	if (self._state == 'off') {
		self.state('automatic')

		self.getUser(function(err, user) {
			if (err) self.error('Error in getInformationsCloud');
			else {
				var fpPriority = [];

				if (typeof options != 'undefined') {
					if (typeof options['priority'] != 'undefined') fpPriority = options['priority'];
				}

				for (var i = 0; i < fpPriority.length; i++) {
					self.synchronize(fpPriority[i]);
				}
				for (var uuid in user.sensors) {
					self.synchronize(uuid);
				}
				pushed = true;
			}
		});
		deasync.loopWhile(function() {
			return !pushed;								// This function is sync now
		});
	}
};

FlowerBridge.prototype.syncFlowerPower = function(flowerPower, callback) {
	async.series([
			function(callback) {
				flowerPower.syncSamples(callback);
			}
			// More features?
			], function(err, results) {
				callback(err, results);
			});
};

FlowerBridge.prototype.fnSyncronize = function(uuid, options, callback) {
	var self = this;

	self.state('synchronize');
	var flowerPower = new SyncFP(uuid, self.user, self.api);
	flowerPower.on('newProcess', function(flowerPower) {
		self.proc(flowerPower);
		if (flowerPower.lastProcess == 'Disconnected') {
			self.emit('endProcessFP');
			self.state('off');
			return callback();
		}
	});
	flowerPower.findAndConnect(function(err) {
		if (err) {
			self.emit('endProcessFP');
			self.state('off');
			return callback();
		}
		else self.syncFlowerPower(flowerPower, function(err, res) {
			self.state('off');
			flowerPower.disconnect();
		});
	});
};

FlowerBridge.prototype.fnLive = function(uuid, options, callback) {
	this.state('live');
	var flowerPower = new TaskFP(uuid);

	flowerPower.findAndConnect(function(err, res) {
		console.log(err);
		if (err) {
			this.state('off');
			return callback(err);
		}
		else {
			async.series([
				function(callback) {
					flowerPower.on('newProcess', function(flowerPower) {
						self.proc(flowerPower);
					});
					flowerPower.FP.on('sunlightChange', function(sunlight) {
						console.log('sunlight = ' + sunlight.toFixed(2) + ' mol/m²/d');
					});

					flowerPower.FP.on('soilTemperatureChange', function(temperature) {
						console.log('soil temperature = ' + temperature.toFixed(2) + '°C');
					});

					flowerPower.FP.on('airTemperatureChange', function(temperature) {
						console.log('air temperature = ' + temperature.toFixed(2) + '°C');
					});

					flowerPower.FP.on('soilMoistureChange', function(soilMoisture) {
						console.log('soil moisture = ' + soilMoisture.toFixed(2) + '%');
					});

					flowerPower.FP.on('calibratedSoilMoistureChange', function(soilMoisture) {
						console.log('calibrated soil moisture = ' + soilMoisture.toFixed(2) + '%');
					});

					flowerPower.FP.on('calibratedAirTemperatureChange', function(temperature) {
						console.log('calibrated air temperature = ' + temperature.toFixed(2) + '°C');
					});

					flowerPower.FP.on('calibratedSunlightChange', function(sunlight) {
						console.log('calibrated sunlight = ' + sunlight.toFixed(2) + ' mol/m²/d');
					});

					flowerPower.FP.on('calibratedEaChange', function(ea) {
						console.log('calibrated EA = ' + ea.toFixed(2));
					});

					flowerPower.FP.on('calibratedEcbChange', function(ecb) {
						console.log('calibrated ECB = ' + ecb.toFixed(2) + ' dS/m');
					});

					flowerPower.FP.on('calibratedEcPorousChange', function(ecPorous) {
						console.log('calibrated EC porous = ' + ecPorous.toFixed(2)+ ' dS/m');
					});
					callback();
				},
				function(callback) {
					flowerPower.FP.enableLiveMode(callback);
				},
				function(callback) {
					console.log('live mode');
					setTimeout(callback, options.delay * 1000);
				},
				function(callback) {
					flowerPower.FP.disableLiveMode(callback);
				}
			], function(err, res) {
				this.state('off');
				flowerPower.disconnect(callback);
			});
		}
	});
};

FlowerBridge.prototype.fnUpdate = function(uuid, options, callback) {
	console.log('In comming');
	callback();
};

FlowerBridge.prototype.update = function(uuid) {
	var self = this;

	self.q.push({
		uuid: helpers.uuidCloudToPeripheral(uuid),
		mode: 'update',
		options: {},
		startAction: self.fnUpdate.bind(self)
	});
};

FlowerBridge.prototype.synchronize = function(uuid) {
	var self = this;

	self.q.push({
		uuid: helpers.uuidCloudToPeripheral(uuid),
		mode: 'synchronize',
		options: {},
		startAction: self.fnSyncronize.bind(self)
	});
};

FlowerBridge.prototype.live = function(uuid, delay) {
	var self = this;

	self.q.push({
		uuid: helpers.uuidCloudToPeripheral(uuid),
		mode: 'live',
		options: {
			delay: delay,
		},
		startAction: self.fnLive.bind(self)
	});

};

module.exports = FlowerBridge;
