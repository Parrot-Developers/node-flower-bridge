var SyncFP = require('./SyncFP');
var TaskFP = require('./TaskFP');
var FlowerPowerApi = require('../node-flower-power-cloud/FlowerPowerCloud');
var util = require('util');
var async = require('async');
var EventEmitter = require('events');
var clc = require('cli-color');
var Chance = require('chance');
var deasync = require('deasync');
var chance = new Chance();

function FlowerBridge(url) {
	EventEmitter.call(this);
	this._state = 'off';
	this.user = null;
	console.log(url);
	this.api = new FlowerPowerApi(url);
	this.q = null;
	this.initBridge();
};

util.inherits(FlowerBridge, EventEmitter);

FlowerBridge.prototype.initBridge = function() {
	var self = this;

	self.q = async.queue(function(task, callbackNext) {
		task.startAction(task.name, task.options, callbackNext);
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
		if (error) callback(error, null);
		else {
			var user = self.api.concatJson(results.userConfig, results.garden);
			self.user = user;
			callback(null, user);
		}
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

// FlowerBridge.prototype.automatic = function(options) {
// 	var self = this;
// 	var delay = 15;
//
// 	if (typeof options != 'undefined' && typeof options['delay'] != 'undefinded') {
// 		delay = options['delay'];
// 	}
// 	self.info('New process every ' + delay + ' minutes');
// 	self.syncAll(options);
// 	setInterval(function() {
// 		self.syncAll(options);
// 	}, delay * 60 * 1000);
// };

// FlowerBridge.prototype.syncAll = function(options) {
// 	var self = this;
// 	var pushed = false;
//
// 	if (self._state == 'off') {
// 		self.state('automatic')
//
// 		self.getUser(function(err, user) {
// 			if (err) self.error('Error in getInformationsCloud');
// 			else {
// 				var typeFilter = [];
// 				var fpPriority = [];
//
// 				if (typeof options != 'undefined') {
// 					if (typeof options['type'] != 'undefined') typeFilter = options['type'];
// 					if (typeof options['priority'] != 'undefined') fpPriority = options['priority'];
// 				}
//
// 				// Look type in json
// 				for (var i = 0; i < fpPriority.length; i++) {
// 					self.synchronize(fpPriority[i]);
// 				}
// 				for (var name in user.locations) {
// 					self.synchronize(name);
// 				}
// 				pushed = true;
// 			}
// 		});
// 		deasync.loopWhile(function() {
// 			return !pushed;								// This function is sync now
// 		});
// 	}
// };

FlowerBridge.prototype.syncFlowerPower = function(flowerPower, callback) {
	async.series([
		function(callback) {
			flowerPower.syncStatus(callback);
		},
		function(callback) {
			flowerPower.syncSamples(callback);
		}
		// More features?
	], function(err, results) {
		callback(err, results);
	});
};

FlowerBridge.prototype.fnSyncronize = function(name, options, callback) {
	var self = this;

	self.state('synchronize');
	var flowerPower = new SyncFP(name, self.user, self.api);
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
			if (err) self.error(err);
			self.state('off');
			flowerPower.disconnect();
		});
	});
};

FlowerBridge.prototype.fnLive = function(name, options, callback) {
	var self = this;
	var flowerPower = new TaskFP(name);

	self.state('live');
	flowerPower.on('newProcess', function(flowerPower) {
		self.proc(flowerPower);
		if (flowerPower.lastProcess == 'Disconnected') {
			self.state('off');
			return callback();
		}
	});
	flowerPower.findAndConnect(function(err, res) {
		if (err) {
			self.state('off');
			return callback(err);
		}
		else {
			flowerPower.live(options, function(err) {
				if (err) self.error(err);
				flowerPower.disconnect();
			});
		}
	});
};

FlowerBridge.prototype.fnUpdate = function(name, options, callback) {
	var self = this;
	var flowerPower = new SyncFP(name);

	self.state('Update firmware');
	flowerPower.on('newProcess', function(flowerPower) {
		self.proc(flowerPower);
		if (flowerPower.lastProcess == 'Disconnected') {
			self.state('off');
			return callback();
		}
	});
	flowerPower.findAndConnect(function(err, res) {
		if (err) {
			self.state('off');
			return callback(err);
		}
		else flowerPower.update(options.file, function(err) {
			if (err) self.error(err);
			flowerPower.disconnect();
		});
	});
};

FlowerBridge.prototype.update = function(name, options) {
	var self = this;

	self.q.push({
		name: name,
		mode: 'update',
		options: options,
		startAction: self.fnUpdate.bind(self)
	});
};

FlowerBridge.prototype.synchronize = function(name, options) {
	var self = this;

	self.q.push({
		name: name,
		mode: 'synchronize',
		options: options,
		startAction: self.fnSyncronize.bind(self)
	});
};

FlowerBridge.prototype.live = function(name, options) {
	var self = this;

	self.q.push({
		name: name,
		mode: 'live',
		options: options,
		startAction: self.fnLive.bind(self)
	});
};

FlowerBridge.prototype.all = function(fn, options) {
	var self = this;
	var pushed = false;

	self.getUser(function(err, user) {
		console.log('\t + Test error 1');
		if (err) self.error('Error in getInformationsCloud');
		else {
			console.log('\t + Test error 2');
			var typeFilter = [];
			var fpPriority = [];

			if (typeof options != 'undefined') {
				if (typeof options['type'] != 'undefined') typeFilter = options['type'];
				if (typeof options['priority'] != 'undefined') fpPriority = options['priority'];
			}
			console.log('\t + Test error 3');

			// Look type in json
			for (var i = 0; i < fpPriority.length; i++) {
				self[fn](fpPriority[i], options);
			}
			console.log('\t + Test error 4');

			for (var name in user.locations) {
				if (typeFilter.length == 0 || typeFilter.indexOf(user.locations[name].sensor.sensor_type) != -1) {
					self[fn](name, options);
				}
			}
			pushed = true;
			console.log('\t + Test error 5');
		}
	});
	console.log('none');
	deasync.loopWhile(function() {
		if (pushed) console.log('PUSHED!');
		return !pushed;								// This function is sync now
	});
};

module.exports = FlowerBridge;
