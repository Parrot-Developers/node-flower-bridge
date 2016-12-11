const util = require('util');
const async = require('async');
const SyncFP = require('./SyncFP');
const EventEmitter = require('events');
const FlowerPowerApi = require('flower-power-api');
const _ = require('lodash');

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

	this.q = async.queue((task, callbackNext) => {
		if (task.user) return this.do(task, callbackNext);

		this.getUser((err, user) => {
			if (err) return callbackNext(err);

			task.user = user;
			this.do(task, callbackNext);
		});
	}, 1);

	this.q.drain = () => this.emit('end');
};

FlowerBridge.prototype.do = function(task, callbackNext) {
	const flowerPower = new SyncFP(task.identifier, task.user, this.api);

	this.state(task.mode);
	flowerPower.on('newProcess', (flowerPower) => {
		this.proc(flowerPower);
		if (flowerPower.lastProcess == 'Disconnected') {
			this.state('off');
			return callbackNext();
		}
	});

	task.startAction(flowerPower, task.options, (err, res) => {
		this.state('off');
		callbackNext(err, res);
	});
};

/**
	To connect your bridge to the Parrot cloud
	@param {object} credentials - `client_id` `client_secret` `username` `password`
*/
FlowerBridge.prototype.loginToApi = function(credentials, callback) {
	this.api.login(credentials, (err, token) => {
		if (!err) this.emit('login', token);
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
	async.parallel({
		garden: this.api.getGarden.bind(this.api),
		user: this.api.getProfile.bind(this.api)
	}, (error, results) => {
		this.user = _.assign({}, results.user, results.garden);
		callback(error, this.user);
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
	const delay = (typeof options != 'undefined' && typeof options.delay != 'undefined')
		? options.delay
		: 15;

	this.info('New process every ' + delay + ' minutes');
	this.all('synchronize', options);
	setInterval(
		() => (this._state == 'off') ? this.all('synchronize', options) : null,
		delay * 60 * 1000
	);
};

FlowerBridge.prototype.syncFlowerPower = function(flowerPower, callback) {
	async.series([
			flowerPower.syncSamples.bind(flowerPower)
		// More features?
	], callback);
};

FlowerBridge.prototype.fnSyncronize = function(flowerPower, options, callback) {
	flowerPower.findAndConnect((err) => {
		if (err) return callback(err);

		this.syncFlowerPower(flowerPower, (err) => {
			if (err) this.error(err);
			flowerPower.disconnect();
		});

	});
};

FlowerBridge.prototype.fnLive = function(flowerPower, options, callback) {
	async.series([
		next => flowerPower.findAndConnect(next),
		next => flowerPower.live(options, next)
	], (err) => {
		if (err) this.error(err);
		if (flowerPower) flowerPower.disconnect();
	});
};

FlowerBridge.prototype.fnUpdate = function(flowerPower, options, callback) {
	async.series([
		next => flowerPower.findAndConnect(next),
		next => flowerPower.syncSamples(next),
		next => flowerPower.update(options.file, next)
	], (err) => {
		if (err) this.error(err);
		if (flowerPower) flowerPower.disconnect();
	});
};

/**
	* [Update mode]
	* - Synchronize historic samples
	* - Update the frimware
	* @param {string} identifier - The identifier of the flower power
	* @param {object} options - `options[file]` -> Binary file to update the flower power
*/
FlowerBridge.prototype.update = function(identifier, options, user) {
	this.q.push({
		mode: 'update',
		identifier,
		options,
		user,
		startAction: this.fnUpdate.bind(this)
	});
};

/**
	* [Synchronize mode]
	* - Synchronize historic samples
	* @param {string} identifier - The identifier of the flower power
*/
FlowerBridge.prototype.synchronize = function(identifier, options, user) {
	this.q.push({
		mode: 'synchronize',
		identifier,
		options,
		user,
		startAction: this.fnSyncronize.bind(this)
	});
};

/**
	* [Live mode]
	* - Show every second each data of a sensor
	* @default options[delay] = 5
	* @param {string} identifier - The identifier of the flower power
	* @param {json} options - `options[delay]` -> Delay of the live mode
*/
FlowerBridge.prototype.live = function(identifier, options, user) {
	this.q.push({
		mode: 'live',
		identifier,
		options,
		user,
		startAction: this.fnLive.bind(this)
	});
};

/**
* Apply then `action` for **all** flower powers of your garden.
* * `options[delay]` -> Do an action every `delay` minutes.
* * `options[priority]` -> `array` of identifier: Do this action for these flower power **befor** the normal process.
* @param {string} action - The name of the function to apply.
* @param {object} options - Options to deal with all sensors.
*/
FlowerBridge.prototype.all = function(action, options) {

	this.getUser((err, user) => {
		if (err) return this.error('Error in getInformationsCloud');

		const locations = _.get(user, 'locations', []);

		_.each(locations, (location) => this[action](_.get(location, 'sensor.sensor_identifier')), options, user);
	});
};

module.exports = FlowerBridge;
