function isFormatPeripheral(str) {
	if (typeof str == 'string' && str.length === 12) {
		return true;
	}
	return false;
}

function isFormatCloud(str) {
	if (typeof str == 'string' && str.length === 16) {
		return true;
	}
	return false;
}

function uuidPeripheralToCloud(uuid) {
	if (isFormatPeripheral(uuid)) {
		return ((uuid.substr(0, 6) + '0000' + uuid.substr(6, 6)).toUpperCase());
	}
	else {
		return (uuid);
	}
}

function uuidCloudToPeripheral(uuid) {
	if (isFormatCloud(uuid)) {
		return (uuid.substr(0, 6).toLowerCase() + uuid.substr(10, 6).toLowerCase());
	}
	else {
		return (uuid);
	}
}

exports.uuidPeripheralToCloud = uuidPeripheralToCloud;
exports.uuidCloudToPeripheral = uuidCloudToPeripheral;
