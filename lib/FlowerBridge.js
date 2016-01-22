var util = require('util');
var async = require('async');
var SyncFP = require('./SyncFP');
var helpers = require('./helpers');
var EventEmitter = require('events');
var FlowerPowerApi = require('flower-power-api');

/**
	* FlowerBridge - Module to build a bridge form BLE/sensors and CLOUD/Parrot
	* @class
*/
function FlowerBridge() {
	EventEmitter.call(this);
	this._state = 'off';
	this.user = null;
	this.api = new FlowerPowerApi();
	this.q = null;
	this.initBridge();
}

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
	var flowerPower = new SyncFP(task.uuid, task.user, self.api);

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

/**
	To connect your bridge to the Parrot cloud
	@param {object} credentials - `client_id` `client_secret` `username` `password`
*/
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


/**
	Get your current profil from the cloud
	* Get all sensor
	* Get user version
	@param {function} callback - The callback **after** getting information form cloud
*/
FlowerBridge.prototype.getUser = function(callback) {
	var self = this;

	async.parallel({
		garden: self.api.getGarden.bind(self.api),
		userConfig: self.api.getProfile.bind(self.api)
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

/**
	Synchronize periodicly all of your flower powers
	@default options[delay] = 15; // minutes
	@param {object} options - `delay` `priority`
*/
FlowerBridge.prototype.automatic = function(options) {
	var self = this;
	var delay = 15;

	if (typeof options != 'undefined' && typeof options.delay != 'undefined') {
		delay = options.delay;
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
			flowerPower.syncSamples(callback);
		}
		// More features?
	], function(err) {
		callback(err);
	});
};

FlowerBridge.prototype.fnSyncronize = function(flowerPower, options, callback) {
	var self = this;

	flowerPower.findAndConnect(function(err) {
		if (err) return callback(err);
		else self.syncFlowerPower(flowerPower, function(err) {
			if (err) self.error(err);
			flowerPower.disconnect();
		});
	});
};

FlowerBridge.prototype.fnLive = function(flowerPower, options, callback) {
	var self = this;

	flowerPower.findAndConnect(function(err) {
		if (err) return callback(err);
		else flowerPower.live(options, function(err) {
			if (err) self.error(err);
			flowerPower.disconnect();
		});
	});
};

FlowerBridge.prototype.fnUpdate = function(flowerPower, options, callback) {
	var self = this;

	flowerPower.findAndConnect(function(err) {
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

/**
	* [Update mode]
	* - Synchronize historic samples
	* - Update the frimware
	* @param {string} uuid - The Uuid of the flower power
	* @param {object} options - `options[file]` -> Binary file to update the flower power
*/
FlowerBridge.prototype.update = function(uuid, options, user) {
	var self = this;

	self.q.push({
		uuid: helpers.uuidCloudToPeripheral(uuid),
		mode: 'update',
		options: options,
		user: user,
		startAction: self.fnUpdate.bind(self)
	});
};

/**
	* [Synchronize mode]
	* - Synchronize historic samples
	* @param {string} uuid - The Uuid of the flower power
*/
FlowerBridge.prototype.synchronize = function(uuid, options, user) {
	var self = this;

	self.q.push({
		uuid: helpers.uuidCloudToPeripheral(uuid),
		mode: 'synchronize',
		options: options,
		user: user,
		startAction: self.fnSyncronize.bind(self)
	});
};

/**
	* [Live mode]
	* - Show every second each data of a sensor
	* @default options[delay] = 5
	* @param {string} uuid - The Uuid of the flower power
	* @param {json} options - `options[delay]` -> Delay of the live mode
*/
FlowerBridge.prototype.live = function(uuid, options, user) {
	var self = this;

	self.q.push({
		uuid: helpers.uuidCloudToPeripheral(uuid),
		mode: 'live',
		options: options,
		user: user,
		startAction: self.fnLive.bind(self)
	});
};

/**
* Apply then `action` for **all** flower powers of your garden.
* * `options[delay]` -> Do an action every `delay` minutes.
* * `options[priority]` -> `array` of uuid: Do this action for these flower power **befor** the normal process.
* @param {string} action - The name of the function to apply.
* @param {object} options - Options to deal with all sensors.
*/
FlowerBridge.prototype.all = function(action, options) {
	var self = this;

	self.getUser(function(err, user) {
		if (err) self.error('Error in getInformationsCloud');
		else {
			var fpPriority = [];

			if (typeof options != 'undefined') {
				if (typeof options.priority != 'undefined') fpPriority = options.priority;
			}

			// Look type in json
			for (var i = 0; i < fpPriority.length; i++) {
				self[action](fpPriority[i], options, user);
			}

			for (var uuid in user.sensors) {
				self[action](helpers.uuidCloudToPeripheral(uuid), options, user);
			}
		}
	});
};

module.exports = FlowerBridge;
