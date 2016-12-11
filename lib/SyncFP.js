const TaskFP = require('./TaskFP');
const _ = require('lodash');
const conf = require('../conf');

function SyncFP(flowerPowerIdentifier, user, api) {
	TaskFP.call(this, flowerPowerIdentifier);
	this.user = user;
	this.api = api;
}

SyncFP.prototype = Object.create(TaskFP.prototype);
SyncFP.prototype.constructor = SyncFP;

SyncFP.prototype.syncSamples = function(callback) {
	const location = _.find(this.user.locations, (location) => location.sensor.sensor_identifier == this.FP.name);
	const cloudIndex = location.sensor.current_history_index;

	this.getSamples(cloudIndex, (err, dataBLE) => {
		if (err) return callback(err);
		else if (!this.user) return callback(new Error('Not logged'), null);

		this.proc('Sending samples');
		const now = new Date();
		const param = {
			'session_histories': [{
				'sensor_serial': this.FP.name,
				'sensor_startup_timestamp_utc': dataBLE.start_up_time,
				'session_id': dataBLE.history_current_session_id,
				'session_start_index': dataBLE.history_current_session_start_index,
				'sample_measure_period': dataBLE.history_current_session_period
			}],
			'uploads': [{
				'sensor_serial': this.FP.name,
				'upload_timestamp_utc': now.toISOString(),
				'buffer_base64': dataBLE.buffer_base64,
				'app_version': `${conf.version}_${conf.name}`,
				'sensor_fw_version': dataBLE.firmware_version,
				'sensor_hw_identifier': dataBLE.hardware_version
			}],
			'client_datetime_utc': now.toISOString(),
			'user_config_version': this.user.user_config_version,
			'plant_science_database_identifier': 'en_20151020_3.0.2'
		};

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
