var TaskFP = require('./TaskFP');
var helpers = require('./helpers');

function SyncFP(flowerPowerUuid, user, api) {
	TaskFP.call(this, flowerPowerUuid);
	this.user = user;
	this.api = api;
	this.process = [];
}

SyncFP.prototype = Object.create(TaskFP.prototype);
SyncFP.prototype.constructor = SyncFP;

SyncFP.prototype.syncSamples = function(callback) {
	var self = this;

	self.getSamples(function(err, dataBLE) {
		if (err) return callback(err);
		self.proc('Sending samples');
		var param = {};
		var session = {};
		var uploads = {};
		var now = new Date();

		param["tmz_offset"] = self.user.user_profile.tmz_offset;
		param["client_datetime_utc"] = now.toISOString();
		param["user_config_version"] = self.user.user_config_version;

		session["sensor_serial"] = helpers.uuidPeripheralToCloud(self.FP.uuid);
		session["sensor_startup_timestamp_utc"] = dataBLE.start_up_time;
		session["session_id"] = dataBLE.history_current_session_id;
		session["session_start_index"] = dataBLE.history_current_session_start_index;
		session["sample_measure_period"] = dataBLE.history_current_session_period;

		uploads["sensor_serial"] = helpers.uuidPeripheralToCloud(self.FP.uuid);
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

module.exports = SyncFP;
