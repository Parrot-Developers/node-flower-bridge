const TaskFP = require('./TaskFP');
const helpers = require('./helpers');

function SyncFP(flowerPowerUuid, user, api) {
	TaskFP.call(this, flowerPowerUuid);
	this.user = user;
	this.api = api;
}

SyncFP.prototype = Object.create(TaskFP.prototype);
SyncFP.prototype.constructor = SyncFP;

SyncFP.prototype.syncSamples = function(callback) {
	const cloudIndex = this.user.sensors[helpers.uuidPeripheralToCloud(this.FP.uuid)].current_history_index;

	this.getSamples(cloudIndex, (err, dataBLE) => {
		if (err) return callback(err);
		else if (!this.user) return callback(new Error('Not logged'), null);

		this.proc('Sending samples');
		const param = {};
		const session = {};
		const uploads = {};
		const now = new Date();

		param.tmz_offset = this.user.user_profile.tmz_offset;
		param.client_datetime_utc = now.toISOString();
		param.user_config_version = this.user.user_config_version;

		session.sensor_serial = helpers.uuidPeripheralToCloud(this.FP.uuid);
		session.sensor_startup_timestamp_utc = dataBLE.start_up_time;
		session.session_id = dataBLE.history_current_session_id;
		session.session_start_index = dataBLE.history_current_session_start_index;
		session.sample_measure_period = dataBLE.history_current_session_period;

		uploads.sensor_serial = helpers.uuidPeripheralToCloud(this.FP.uuid);
		uploads.upload_timestamp_utc = now.toISOString();
		uploads.buffer_base64 = dataBLE.buffer_base64;
		uploads.app_version = "";
		uploads.sensor_fw_version = dataBLE.firmware_version;
		uploads.sensor_hw_identifier = dataBLE.hardware_version;

		param.session_histories = [session];
		param.uploads = [uploads];

		this.api.sendSamples(param, (error) => {
			if (!error) {
				this.state = 'Updated';
				this.proc('Updated', true);
			}
			else {
				this.state = 'Failed to updated';
				this.proc('Failed to update', true);
			}
			return callback(error);
		});
	});
};

module.exports = SyncFP;
