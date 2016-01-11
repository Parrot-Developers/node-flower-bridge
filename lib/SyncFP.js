var TaskFP = require('./TaskFP');
var helpers = require('./helpers');

function SyncFP(flowerPowerName, user, api) {
	TaskFP.call(this, flowerPowerName);
	this.user = user;
	this.api = api;
}

SyncFP.prototype = Object.create(TaskFP.prototype);
SyncFP.prototype.constructor = SyncFP;

SyncFP.prototype.syncSamples = function(callback) {
	var self = this;

	self.getSamples(function(err, dataBLE) {
		if (err) return callback(err, null);
		else if (!self.user) return callback(new Error('Not logged'), null);
		self.proc('Sending samples');
		var param = {};
		var session = {};
		var uploads = {};
		var now = new Date();

		param["client_datetime_utc"] = now.toISOString();
		param["user_config_version"] = self.user.user_config_version;
		param["plant_science_database_identifier"] = "en_20151020_3.0.2";

		session["sensor_serial"] = self.FP.name;
		session["sensor_startup_timestamp_utc"] = dataBLE.start_up_time;
		session["session_id"] = dataBLE.history_current_session_id;
		session["session_start_index"] = dataBLE.history_current_session_start_index;
		session["sample_measure_period"] = dataBLE.history_current_session_period;

		uploads["sensor_serial"] = self.FP.name;
		uploads["upload_timestamp_utc"] = now.toISOString();
		uploads["buffer_base64"] = dataBLE.buffer_base64;
		uploads["app_version"] = "";
		uploads["sensor_fw_version"] = dataBLE.firmware_version;
		uploads["sensor_hw_identifier"] = dataBLE.hardware_version;

		param["session_histories"] = [session];
		param["uploads"] = [uploads];

		self.api.sendSamples(param, function(error, resutls) {
			if (!error) {
				self.state = 'Updated';
				self.proc('Updated', true);
			}
			else {
				self.state = 'Failed to updated';
				self.proc('Failed to update', true);
			}
			return callback(error, resutls);
		});
	});
};

SyncFP.prototype.syncStatus = function(callback) {
	var self = this;

	self.getStatusWatering(function(err, watering) {
		self.proc('Sending status watering');
		var param = {};
		var update_status = {};
		var now = new Date();

		if (!self.user) return callback(new Error('Not logged'), null);
		param["client_datetime_utc"] = now.toISOString();
		param["user_config_version"] = self.user.user_config_version;
		update_status['location_identifier'] = self.user.locations[self.FP.name].location_identifier;
		update_status['status_creation_datetime_utc'] = self.user.locations[self.FP.name].status_creation_datetime_utc;
		update_status['watering'] = watering;

		param['update_status'] = [update_status];
		console.log(param);
		self.api.sendGardenStatus(param, function(error, results) {
			if (!error) {
				self.state = 'Status updated';
				self.proc('Status updated', true);
			}
			else {
				self.state = 'Failed to status updated';
				self.proc('Failed to status updated', true);
			}
			return callback(error, self.state);
		});
	});
};

module.exports = SyncFP;
