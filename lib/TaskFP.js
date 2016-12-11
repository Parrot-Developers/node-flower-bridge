const util = require('util');
const async = require('async');
const EventEmitter = require('events');
const FlowerPower = require('flower-power-ble');
const _ = require('lodash');

const Datastore = require('nedb');
const db = new Datastore({filename: 'database/process.db', autoload: true});

const DELAY_SEARCHING_ATTEMPT = 30000;
const DELAY_CONNECTION_ATTEMPT = 60000;
const RETRY_SEARCHING = 3;

function TaskFP(flowerPowerIdentifer) {
	EventEmitter.call(this);
	this.FP = null;
	this.lastDate = new Date();
	this.identifier = flowerPowerIdentifer;
	this.process = [];
	this.lastProcess = 'Standby';
	this.charac = {
		start_up_time: "getStartupTime",
		firmware_version: "readFirmwareRevision",
		hardware_version: "readHardwareRevision",
		history_nb_entries: "getHistoryNbEntries",
		soil_percent_vwc: 'getCalibratedSoilMoisture',
		history_last_entry_index: "getHistoryLastEntryIdx",
		history_current_session_id: "getHistoryCurrentSessionID",
		history_current_session_period: "getHistoryCurrentSessionPeriod",
		history_current_session_start_index: "getHistoryCurrentSessionStartIdx"
	};

	return this;
}

util.inherits(TaskFP, EventEmitter);

TaskFP.prototype.proc = function(processMsg, pushDb) {

	this.process.unshift(processMsg);
	this.lastProcess = processMsg;
	this.lastDate = new Date();
	this.emit('newProcess', this);
	if (pushDb) {
		db.insert({
			identifier: this.identifier,
			proc: this.lastProcess,
			date: this.lastDate
		});
	}
};

TaskFP.prototype.toString = function() {
	return (`[${this.lastDate.toString().substr(4, 20)}]: ${this.identifier} : ${this.lastProcess}`);
};

TaskFP.prototype.readDataBLE = function(keys) {
	return new Promise((resolve, reject) => {
		const readerFn = {};
		const makeFn = fnName => callback => this.FP[fnName](callback);

		_.each(keys, (key) => readerFn[key] = makeFn(this.charac[key]));

		async.parallel(readerFn, (err, results) => {
			if (err) reject(err);
			else resolve(results);
		});
	});
};

TaskFP.prototype.findAndConnect = function(callback) {
	const self = this;

	async.auto({
		search: async.retry({times: RETRY_SEARCHING, interval: 2000}, this.search.bind(self)),
		init: ['search', this.init.bind(self)],
		connect: ['init', this.connect.bind(self)]
	}, callback);

};

TaskFP.prototype.search = function(callback) {
	const self = this;

	this.proc('Searching');
	const discover = (device) => {
		if (device.name != this.identifier) return this.destroy(device);

		this.FP = device;
		FlowerPower.stopDiscoverAll(discover);
		this.proc('Found');
		return callback(null, device);
	};
	setTimeout(() => {
		if (this.process[0] == 'Searching') {
			FlowerPower.stopDiscoverAll(discover);
			this.proc('Not found', true);
			return callback('Not found');
		}
	}, DELAY_SEARCHING_ATTEMPT);

	FlowerPower.discoverAll(discover);
};

TaskFP.prototype.init = function(callback) {
	const self = this;

	this.FP._peripheral.on('disconnect', () => {
		this.proc('Disconnected');
		this.destroy(this.FP);
	});
	this.FP._peripheral.on('connect', () => {
		this.proc('Connected');
	});

	switch (this.FP._peripheral.state) {
		case 'disconnected':
			this.proc('Connection');
			callback(null);
			break;
		case 'connecting':
			this.proc('Not availaible: is on connection');
			this.destroy(this.FP);
			callback('Connecting');
			break;
		default:
			this.proc('Not available: ' + this.FP._peripheral.state, true);
			this.destroy(this.FP);
			callback('Not available');
		}
};

TaskFP.prototype.connect = function(callback) {
	const self = this;

	setTimeout(() => {
		if (this.process[0] == 'Connection') {
			this.proc('Connection failed', true);
			this.destroy(this.FP);
			throw (this.FP.identifier + ': Connection failed');
		}
	}, DELAY_CONNECTION_ATTEMPT);

	this.FP.connectAndSetup(callback);
};

TaskFP.prototype.disconnect = function(callback) {
	const self = this;

	this.FP.disconnect(() => {
		if (typeof callback == 'function') return callback(null);
	});
};

TaskFP.prototype.destroy = function(device) {
	device._peripheral.removeAllListeners();
	device.removeAllListeners();
	device = null;
};

TaskFP.prototype.getSamples = function(index, callback) {
	const self = this;

	this.proc('Getting samples');
	this.readDataBLE([
		'start_up_time',
		'firmware_version',
		'hardware_version',
		'history_nb_entries',
		'history_last_entry_index',
		'history_current_session_id',
		'history_current_session_period',
		'history_current_session_start_index'
	]).then((dataBLE) => {
		const hw_v = dataBLE.hardware_version;
		const fw_v = dataBLE.firmware_version;
		const firstEntryIndex = dataBLE.history_last_entry_index - dataBLE.history_nb_entries + 1;
		const startIndex = (index >= firstEntryIndex) ? index : firstEntryIndex;

		dataBLE.hardware_version = hw_v.substr(0, (hw_v.indexOf('\u0000')) ? hw_v.indexOf('\u0000') : hw_v.length);
		dataBLE.firmware_version = fw_v.substr(0, (fw_v.indexOf('\u0000')) ? fw_v.indexOf('\u0000') : fw_v.length);

		if (startIndex > dataBLE.history_last_entry_index) {
			this.proc('No update required', true);
			return callback('No update required');
		}
		this.FP.getHistory(startIndex, (error, history) => {
			dataBLE.buffer_base64 = history;
			return callback(error, dataBLE);
		});
	});
};

TaskFP.prototype.live = function(options, callback) {
	const self = this;
	const delay = 10;

	if (typeof options.delay != 'undefined') delay = options.delay;

	this.FP
		.on('sunlightChange',
			(sunlight) => console.log('sunlight = ' + sunlight.toFixed(2) + ' mol/m²/d'))
		.on('soilTemperatureChange',
			(temperature) => console.log('soil temperature = ' + temperature.toFixed(2) + '°C'))
		.on('airTemperatureChange',
			(temperature) => console.log('air temperature = ' + temperature.toFixed(2) + '°C'))
		.on('soilMoistureChange',
			(soilMoisture) => console.log('soil moisture = ' + soilMoisture.toFixed(2) + '%'))
		.on('calibratedSoilMoistureChange',
			(soilMoisture) => console.log('calibrated soil moisture = ' + soilMoisture.toFixed(2) + '%'))
		.on('calibratedAirTemperatureChange',
			(temperature) => console.log('calibrated air temperature = ' + temperature.toFixed(2) + '°C'))
		.on('calibratedSunlightChange',
			(sunlight) => console.log('calibrated sunlight = ' + sunlight.toFixed(2) + ' mol/m²/d'))
		.on('calibratedEaChange',
			(ea) => console.log('calibrated EA = ' + ea.toFixed(2)))
		.on('calibratedEcbChange',
			(ecb) => console.log('calibrated ECB = ' + ecb.toFixed(2) + ' dS/m'))
		.on('calibratedEcPorousChange',
			(ecPorous) => console.log('calibrated EC porous = ' + ecPorous.toFixed(2)+ ' dS/m'));
	async.series([
		(callback) => {
			this.proc('Live');
			this.FP.enableLiveMode(callback);
		},
		(callback) => setTimeout(callback, delay * 1000),
		(callback) => {
			this.proc('End live');
			this.FP.disableLiveMode(callback);
		}
	], callback);
};

TaskFP.prototype.update = function(file, callback) {
	this.proc('Update');
	this.FP.updateFirmware(file, callback);
};

module.exports = TaskFP;
