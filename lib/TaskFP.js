var util = require('util');
var async = require('async');
var clc = require('cli-color');
var EventEmitter = require('events');
var FlowerPower = require('../node-flower-power/index');

var Datastore = require('nedb');
var db = new Datastore({filename: 'database/process.db', autoload: true});

const DELAY_SEARCHING_ATTEMPT = 30000;
const DELAY_CONNECTION_ATTEMPT = 60000;

function TaskFP(flowerPowerName) {
	EventEmitter.call(this);
	this.FP = null;
	this.lastDate = new Date();
	this.name = flowerPowerName;
	this.process = [];
	this.lastProcess = 'Standby';
	this.charac = {
		status_flags: 'getStatusFlags',
		start_up_time: "getStartupTime",
		watering_mode: 'getWateringMode',
		water_tank_level: "getWaterTankLevel",
		firmware_version: "readFirmwareRevision",
		hardware_version: "readHardwareRevision",
		history_nb_entries: "getHistoryNbEntries",
		full_tank_autonomy: 'getFullTankAutonomy',
		next_empty_tank_date: 'getNextEmptyTankDate',
		soil_percent_vwc: 'getCalibratedSoilMoisture',
		next_watering_date: 'getNextWateringDateTime',
		history_last_entry_index: "getHistoryLastEntryIdx",
		watering_algorithm_status: "getWateringAlgorithmStatus",
		history_current_session_id: "getHistoryCurrentSessionID",
		history_current_session_period: "getHistoryCurrentSessionPeriod",
		history_current_session_start_index: "getHistoryCurrentSessionStartIdx",
	};

	return this;
};

util.inherits(TaskFP, EventEmitter);

TaskFP.prototype.proc = function(processMsg, pushDb) {
	var self = this;

	self.process.unshift(processMsg);
	self.lastProcess = processMsg;
	self.lastDate = new Date();
	self.emit('newProcess', self);
	if (pushDb) {
		db.insert({
			name: self.name,
			proc: self.lastProcess,
			date: self.lastDate
		});
	}
};

TaskFP.prototype.toString = function() {
		return ("[" + this.lastDate.toString().substr(4, 20) + "]: " + this.name + ": " + this.lastProcess);
};

TaskFP.prototype.readDataBLE = function(keys) {
	var self = this;

	return new Promise(function(resolve, reject) {
		var array = {};
		var makeFn = function(fnName) {
			return function(callback) {
				self.FP[fnName](callback);
			};
		}

		for (var i in keys) {
			array[keys[i]] = makeFn(self.charac[keys[i]]);
		}
		async.parallel(array, function(err, results) {
			if (err) reject(err);
			else resolve(results);
		});
	});
};

TaskFP.prototype.findAndConnect = function(callback) {
	var self = this;

	self.search(function(err, device) {
		if (err) return callback(err);
		else {
			async.series([
				function(callback) {
					self.init(callback);
				},
				function(callback) {
					self.connect(callback);
				}
				], function(err) {
					if (err) self.destroy(device);
					return callback(err, null);
				});
		}
	});
};

TaskFP.prototype.search = function(callback) {
	var self = this;

	self.proc('Searching');
	var discover = function(device) {
		if (device.name == self.name) {
			self.FP = device;
			FlowerPower.stopDiscoverAll(discover);
			self.proc('Found');
			return callback(null, device);
		}
		else self.destroy(device);
	};
	setTimeout(function() {
		if (self.process[0] == 'Searching') {
			FlowerPower.stopDiscoverAll(discover);
			self.proc('Not found', true);
			return callback('Not found');
		}
	}, DELAY_SEARCHING_ATTEMPT);

	FlowerPower.discoverAll(discover);
};

TaskFP.prototype.init = function(callback) {
	var self = this;

	self.FP._peripheral.on('disconnect', function() {
		self.proc('Disconnected');
		self.destroy(self.FP);
	});
	self.FP._peripheral.on('connect', function() {
		self.proc('Connected');
	});

	if (self.FP._peripheral.state == 'disconnected') {
		self.proc('Connection');
		return callback(null);
	}
	else if (self.FP._peripheral.state == 'connecting') {
		self.proc('Not availaible: is on connection');
		return callback('Connecting');
	}
	else {
		self.proc('Not available: ' + self.FP._peripheral.state, true);
		return callback('Not available');
	}
};

TaskFP.prototype.connect = function(callback) {
	var self = this;

	setTimeout(function() {
		if (self.process[0] == 'Connection') {
			self.proc('Connection failed', true);
			self.destroy(self.FP);
			throw (self.FP.name + ': Connection failed');
		}
	}, DELAY_CONNECTION_ATTEMPT);

	self.FP.connectAndSetup(function() {
		return callback(null);
	});
};

TaskFP.prototype.disconnect = function(callback) {
	var self = this;

	self.FP.disconnect(function() {
		if (typeof callback == 'function') {
			return callback(null);
		}
	});
};

TaskFP.prototype.destroy = function(device) {
	device._peripheral.removeAllListeners();
	device.removeAllListeners();
	device = null;
};

TaskFP.prototype.getSamples = function(callback) {
	var self = this;

	self.proc('Getting samples');
	self.readDataBLE([
			'start_up_time',
			'firmware_version',
			'hardware_version',
			'history_nb_entries',
			'history_last_entry_index',
			'history_current_session_id',
			'history_current_session_period',
			'history_current_session_start_index'
			]).then(function(dataBLE) {
				var hw_v = dataBLE.hardware_version;
				var fw_v = dataBLE.firmware_version;
				var cloudIndex = self.user.locations[self.FP.name].sensor.current_history_index;
				var firstEntryIndex = dataBLE.history_last_entry_index - dataBLE.history_nb_entries + 1;
				var startIndex = (cloudIndex >= firstEntryIndex) ? cloudIndex : firstEntryIndex;

				dataBLE.hardware_version = hw_v.substr(0, (hw_v.indexOf('\u0000')) ? hw_v.indexOf('\u0000') : hw_v.length);
				dataBLE.firmware_version = fw_v.substr(0, (fw_v.indexOf('\u0000')) ? fw_v.indexOf('\u0000') : fw_v.length);

				if (startIndex > dataBLE.history_last_entry_index) {
					self.proc('No update required', true);
					return callback('No update required');
				}
				self.FP.getHistory(startIndex, function(error, history) {
					dataBLE.buffer_base64 = history;
					return callback(error, dataBLE);
				});
			});
};

TaskFP.prototype.getStatusWatering = function(callback) {
	var self = this;

	self.proc('Getting status watering');
	var watering = {
		'status_key': 'status_ok',
		'instruction_key': 'soil_moisture_good',
		'soil_moisture': {
			'status_key': 'status_ok',
			'instruction_key': 'soil_moisture_good',
			'current_vwc': 0
		},
		'automatic_watering': {
			'status_key': 'status_ok',
			'instruction_key': 'automatic_watering_off',
			'next_watering_datetime_utc': null,
			'full_autonomy_days': null,
			'predicted_action_datetime_utc': null,
			'current_water_level': 0
		}
	};

	self.readDataBLE(['soil_percent_vwc']).then(function(dataCommun) {

		watering['soil_moisture']['current_vwc'] = dataCommun.soil_percent_vwc;

		if (self.FP.generation == 1) return callback(null, watering);
		else if (self.FP.generation == 2) {
			self.readDataBLE([
				'status_flags'
				]).then(function(dataFlags) {
					if (dataFlags.status_flags['Soil dry'] && !dataFlags.status_flags['Soil wet']) {
						watering['soil_moisture']['status_key'] = 'status_critical';
						watering['soil_moisture']['instruction_key'] = 'soil_moisture_too_low';
					}
					else if (!dataFlags.status_flags['Soil dry'] && dataFlags.status_flags['Soil wet']) {
						watering['soil_moisture']['status_key'] = 'status_warning';
						watering['soil_moisture']['instruction_key'] = 'soil_moisture_too_high';
					}

				if (self.FP.type == 'Flower power') return callback(null, watering);
				else {
					self.readDataBLE([
						'next_watering_date',
						'next_empty_tank_date',
						'full_tank_autonomy',
						'watering_mode',
						'watering_algorithm_status',
						'water_tank_level'
						]).then(function(dataWatering) {
							watering['automatic_watering']['next_watering_datetime_utc'] = (dataWatering.next_watering_date) ? dataWatering.next_watering_date.toISOString() : null;
							watering['automatic_watering']['predicted_action_datetime_utc'] = (dataWatering.next_empty_tank_date) ? dataWatering.next_empty_tank_date.toISOString() : null;
							watering['automatic_watering']['full_autonomy_days'] = (dataWatering.full_tank_autonomy) ? dataWatering.full_tank_autonomy : null;
							if (dataWatering.watering_mode == 'Manual') return callback(null, watering);
							else {
								watering['automatic_watering']['current_water_level'] = dataWatering.water_tank_level;
								watering['automatic_watering']['status_key'] = 'status_critical';
								if (dataWatering.watering_algorithm_status == 'Error vwc still') watering['automatic_watering']['instruction_key'] = 'automatic_watering_check_system';
								else if (dataWatering.watering_algorithm_status == 'Error internal') watering['automatic_watering']['instruction_key'] = 'automatic_watering_unkwown_error';
								else {
									if (dataFlags.status_flags['Sensor in air']) {
										watering['automatic_watering']['status_key'] = 'status_warning';
										watering['automatic_watering']['instruction_key'] = 'automatic_watering_in_air';
									}
									else if (dataFlags.status_flags['Tank empty']) {
										watering['automatic_watering']['status_key'] = 'status_critical';
										watering['automatic_watering']['instruction_key'] = 'automatic_watering_reserve_empty';
									}
									else {
										watering['automatic_watering']['status_key'] = 'status_ok';
										watering['automatic_watering']['instruction_key'] = 'automatic_watering_good';
									}
								}
								watering['status_key'] = watering['automatic_watering']['status_key'];
								watering['instruction_key'] = watering['automatic_watering']['instruction_key'];
								return callback(null, watering);
							}
						});
				}
				});
		}
	});
};

TaskFP.prototype.live = function(options, callback) {
	var self = this;
	var delay = 10;

	if (typeof options.delay != 'undefined') delay = options.delay;
	async.series([
		function(callback) {
			self.FP.on('sunlightChange', function(sunlight) {
				console.log('sunlight = ' + sunlight.toFixed(2) + ' mol/m²/d');
			});

			self.FP.on('soilTemperatureChange', function(temperature) {
				console.log('soil temperature = ' + temperature.toFixed(2) + '°C');
			});

			self.FP.on('airTemperatureChange', function(temperature) {
				console.log('air temperature = ' + temperature.toFixed(2) + '°C');
			});

			self.FP.on('soilMoistureChange', function(soilMoisture) {
				console.log('soil moisture = ' + soilMoisture.toFixed(2) + '%');
			});

			self.FP.on('calibratedSoilMoistureChange', function(soilMoisture) {
				console.log('calibrated soil moisture = ' + soilMoisture.toFixed(2) + '%');
			});

			self.FP.on('calibratedAirTemperatureChange', function(temperature) {
				console.log('calibrated air temperature = ' + temperature.toFixed(2) + '°C');
			});

			self.FP.on('calibratedSunlightChange', function(sunlight) {
				console.log('calibrated sunlight = ' + sunlight.toFixed(2) + ' mol/m²/d');
			});

			self.FP.on('calibratedEaChange', function(ea) {
				console.log('calibrated EA = ' + ea.toFixed(2));
			});

			self.FP.on('calibratedEcbChange', function(ecb) {
				console.log('calibrated ECB = ' + ecb.toFixed(2) + ' dS/m');
			});

			self.FP.on('calibratedEcPorousChange', function(ecPorous) {
				console.log('calibrated EC porous = ' + ecPorous.toFixed(2)+ ' dS/m');
			});
			callback();
		},
		function(callback) {
			self.proc('Live');
			self.FP.enableLiveMode(callback);
		},
		function(callback) {
			setTimeout(callback, delay * 1000);
		},
		function(callback) {
			self.proc('End live');
			self.FP.disableLiveMode(callback);
		}
	], function(err, res) {
		callback(err);
	});
};

TaskFP.prototype.update = function(file, callback) {
	this.proc('Update');
	this.FP.updateFirmware(file, callback);
};

module.exports = TaskFP;
