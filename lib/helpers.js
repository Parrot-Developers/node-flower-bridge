function concatJson(json1, json2) {
	var dest = json1;

	for (var key in json2) {
		if (typeof json1[key] == 'object' && typeof json2[key] == 'object') {
			dest[key] = concatJson(json1[key], json2[key]);
		}
		else {
			dest[key] = json2[key];
		}
	}
	return dest;
}

function uuidPeripheralToCloud(uuid) {
	return ((uuid.substr(0, 6) + '0000' + uuid.substr(6, 6)).toUpperCase());
}

function uuidCloudToPeripheral(uuid) {
	return (uuid.substr(0, 6).toLowerCase() + uuid.substr(10, 6).toLowerCase());
}

exports.concatJson = concatJson;
exports.uuidPeripheralToCloud = uuidPeripheralToCloud;
exports.uuidCloudToPeripheral = uuidCloudToPeripheral;
