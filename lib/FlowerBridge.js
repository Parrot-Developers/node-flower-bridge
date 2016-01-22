var fs = require('fs');
var SyncFP = require('./SyncFP');
var TaskFP = require('./TaskFP');
var FlowerPowerApi = require('../node-flower-power-cloud/FlowerPowerCloud');
var util = require('util');
var async = require('async');
var EventEmitter = require('events');
var clc = require('cli-color');
var Chance = require('chance');
var chance = new Chance();

function FlowerBridge(url) {
	EventEmitter.call(this);
	this._state = 'off';
	this.user = null;
	this.api = new FlowerPowerApi(url);
	this.q = null;
	this.initBridge();
};

util.inherits(FlowerBridge, EventEmitter);

FlowerBridge.prototype.initBridge = function() {
	var self = this;

	self.q = async.queue(function(task, callbackNext) {
		if (!task.user) {
			self.getUser(function (err, user) {
				if (err) return callbackNext(err);
				else {
					task.user = user;
					self.do(task, callbackNext);
				}
			});
		}
		else self.do(task, callbackNext);
	}, 1);
};

FlowerBridge.prototype.do = function(task, callbackNext) {
	var self = this;
	var flowerPower = new SyncFP(task.name, task.user, self.api);

	self.state(task.mode);
	flowerPower.on('newProcess', function(flowerPower) {
		self.proc(flowerPower);
		if (flowerPower.lastProcess == 'Disconnected') {
			self.state('off');
			return callbackNext();
		}
	});
	task.startAction(flowerPower, task.options, function(err, res) {
		self.state('off');
		callbackNext(err, res);
	});
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

FlowerBridge.prototype.automatic = function(options) {
	var self = this;
	var delay = 15;

	if (typeof options != 'undefined' && typeof options['delay'] != 'undefinded') {
		delay = options['delay'];
	}
	self.info('New process every ' + delay + ' minutes');
	self.all('synchronize', options);
	setInterval(function() {
		if (self._state == 'off') self.all('synchronize', options);
	}, delay * 60 * 1000);
};

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

FlowerBridge.prototype.fnSyncronize = function(flowerPower, options, callback) {
	var self = this;

	flowerPower.findAndConnect(function(err) {
		if (err) return callback(err)
		else self.syncFlowerPower(flowerPower, function(err, res) {
			if (err) self.error(err);
			flowerPower.disconnect();
		});
	});
};

FlowerBridge.prototype.fnLive = function(flowerPower, options, callback) {
	var self = this;

	flowerPower.findAndConnect(function(err, res) {
		if (err) return callback(err);
		else flowerPower.live(options, function(err) {
			if (err) self.error(err);
			flowerPower.disconnect();
		});
	});
};

FlowerBridge.prototype.fnUpdate = function(flowerPower, options, callback) {
	var self = this;

	flowerPower.findAndConnect(function(err, res) {
		if (err) return callback(err);
		else flowerPower.syncSamples(function(err) {
			if (err != 'No update required' && err) callback(err);
			else flowerPower.update(options.file, function(err) {
				if (err) self.error(err);
				flowerPower.disconnect();
			});
		});
	});
};

FlowerBridge.prototype.update = function(name, options, user) {
	var self = this;

	self.q.push({
		name: name,
		mode: 'update',
		options: options,
		user: user,
		startAction: self.fnUpdate.bind(self)
	});
};

FlowerBridge.prototype.synchronize = function(name, options, user) {
	var self = this;

	self.q.push({
		name: name,
		mode: 'synchronize',
		options: options,
		user: user,
		startAction: self.fnSyncronize.bind(self)
	});
};

FlowerBridge.prototype.live = function(name, options, user) {
	var self = this;

	self.q.push({
		name: name,
		mode: 'live',
		options: options,
		user: user,
		startAction: self.fnLive.bind(self)
	});
};


FlowerBridge.prototype.all = function(fn, options) {
	var self = this;

	self.getUser(function(err, user) {
		if (err) self.error(err);
		else {
			var typeFilter = [];
			var fpPriority = [];

			if (typeof options != 'undefined') {
				if (typeof options['type'] != 'undefined') typeFilter = options['type'];
				if (typeof options['priority'] != 'undefined') fpPriority = options['priority'];
			}

			// Look type in json
			for (var i = 0; i < fpPriority.length; i++) {
				self[fn](fpPriority[i], options, user);
			}
			for (var name in user.locations) {
				if (typeFilter.length == 0 || typeFilter.indexOf(user.locations[name].sensor.sensor_type) != -1) {
					self[fn](name, options, user);
				}
			}
		}
	});
};

module.exports = FlowerBridge;
