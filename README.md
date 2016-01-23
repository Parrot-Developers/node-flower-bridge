![Bridge](https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Suspension_bridge_icon.svg/2000px-Suspension_bridge_icon.svg.png)
![node-flower-bridge](http://img15.hostingpics.net/pics/880820nfb.png)
![Work](http://img15.hostingpics.net/pics/57414831fb.png)


[![Version node](https://img.shields.io/badge/node-4.x-brightgreen.svg)](https://nodejs.org/en/)
[![Issues](https://img.shields.io/badge/issues-open-orange.svg)](https://github.com/Parrot-Developers/node-flower-bridge/issues)
[![Forum](https://img.shields.io/badge/question-forum-blue.svg)](http://forum.developer.parrot.com/c/flower-power)

## Get your access API
* `username` `password`
	* Make sure you have an account created by your smartphone. You should be see your garden: [myflowerpower.parrot.com](https://myflowerpower.parrot.com).
* `client_id` `client_secret`
	* [Sign up to API here](https://apiflowerpower.parrot.com/api_access/signup), and got by **email** your *Access ID* (`client_id`) and your *Access secret* (`client_secret`).

## How to install
This program works with any *BLE-equipped/BLE-dongle-equipped* computers as well.
To install it on your raspberry is really easy. You require Node (with npm) and BLE libraries.

First, you need a raspberry with a *USB BLE dongle*. This raspberry must be up and running.
Then you need to install some required tools on your raspberry.

### Step 1: NodeJs
First, nodejs needs to be installed, proceed as following:
```bash
$ wget http://node-arm.herokuapp.com/node_latest_armhf.deb
$ sudo dpkg -i node_latest_armhf.deb
```

Then do a `node --version` to check if it worked.

### Step 2: BLE libraries
Then we need to install the BLE libraries:
```bash
$ sudo apt-get install libdbus-1-dev libdbus-glib-1-dev libglib2.0-dev libical-dev libreadline-dev libudev-dev libusb-dev glib2.0 bluetooth bluez libbluetooth-dev
```
The command `hciconfig` will be show your dongle (hci0):
```bash
$ sudo hciconfig hci0 up
```
You should be able to discover peripheral around you. To check it, do `sudo hcitool lescan` and if it shows you a list of surrounding BLE devices – or at least your Flower Power -- it works fine. If not, do `sudo apt-get install bluez` and try again.

### Step 3: Build the brigde
Now Nodejs and BLE libraries are installed.

#### Ready to use it
If you have cloned this project, install:
```bash
$ npm install
```
Edit `credentials.json`:
```javascript
{
	"client_id":		"...",
	"client_secret":	"...",
	"username":		 	"...",
	"password":			"..."
}
```
And walk on the brigde:
```bash
$ ./bridge display			 : To have a output:
$ ./bridge background		 : To run the program in background
$ ./bridge restart			 : To restart the program
$ ./bridge stop			     : To stop the program
$ ./bridge					 : To have help
```

##### How it works
* Login Cloud
* Loop (every 15 minutes by default)
  * Get Inforamtions from Cloud
    * Your garden
    * Your user-config
  * For each of your FlowerPowers (1 by 1)
    * Scan to discover the Flower Power
    * Retrieve his history samples
    * Send his history samples to the Cloud
* End Loop

The program relive a new `Loop` only if all Flower Powers have been checked.

#### Quick started for developers
If you have this module in dependencies:
```bash
$ npm install node-flower-bridge
```
```javascript
var bridge = require('node-flower-bridge');
var credentials = {
	"client_id": "...",
	"client_secret": "...",
	"username": "...",
	"password": "..."
};

bridge.loginToApi(credentials, function(err, res) {
	if (err) return console.error(err);
	bridge.all('synchronize');
	bridge.live('...', 5);
	bridge.synchronize('...');
});

bridge.on('newProcess', function(flowerPower) {
	console.log(flowerPower.uuid, flowerPower.lastProcess);
});
bridge.on('info', function(info) {
	console.log(info.message);
});
bridge.on('error', function(error) {
	console.log(error.message);
});
```

The bridge is a continual queud. Method like `.all` `.synchronize` or `.live` push back to this queud.

##### Events
```js
'login' = {access_token, expires_in, refresh_token}
'info' = {message, date}
'error' = {message, date}
'newState' = state
'newProcess' = {uuid, lastProcess, process, lastDate}
```

## Api
**Kind**: global class

* [FlowerBridge](#FlowerBridge)
    * [new FlowerBridge()](#new_FlowerBridge_new)
    * [.loginToApi(credentials)](#FlowerBridge+loginToApi)
    * [.getUser(callback)](#FlowerBridge+getUser)
    * [.automatic(options)](#FlowerBridge+automatic)
    * [.update(uuid, options)](#FlowerBridge+update)
    * [.synchronize(uuid)](#FlowerBridge+synchronize)
    * [.live(uuid, options)](#FlowerBridge+live)
    * [.all(action, options)](#FlowerBridge+all)

<a name="new_FlowerBridge_new"></a>
### new FlowerBridge()
FlowerBridge - Module to build a bridge form BLE/sensors and CLOUD/Parrot

<a name="FlowerBridge+loginToApi"></a>
### flowerBridge.loginToApi(credentials)
To connect your bridge to the Parrot cloud

**Kind**: instance method of <code>[FlowerBridge](#FlowerBridge)</code>

| Param | Type | Description |
| --- | --- | --- |
| credentials | <code>object</code> | `client_id` `client_secret` `username` `password` |

<a name="FlowerBridge+getUser"></a>
### flowerBridge.getUser(callback)
Get your current profil from the cloud
Get all sensor
Get user version

**Kind**: instance method of <code>[FlowerBridge](#FlowerBridge)</code>

| Param | Type | Description |
| --- | --- | --- |
| callback | <code>function</code> | The callback **after** getting information form cloud |

<a name="FlowerBridge+automatic"></a>
### flowerBridge.automatic(options)
Synchronize periodicly all of your flower powers

**Kind**: instance method of <code>[FlowerBridge](#FlowerBridge)</code>
**Default**: <code>options[delay] = 15; // minutes</code>

| Param | Type | Description |
| --- | --- | --- |
| options | <code>object</code> | `delay` `priority` |

<a name="FlowerBridge+update"></a>
### flowerBridge.update(uuid, options)
[Update mode]
- Synchronize historic samples
- Update the frimware

**Kind**: instance method of <code>[FlowerBridge](#FlowerBridge)</code>

| Param | Type | Description |
| --- | --- | --- |
| uuid | <code>string</code> | The Uuid of the flower power |
| options | <code>object</code> | `options[file]` -> Binary file to update the flower power |

<a name="FlowerBridge+synchronize"></a>
### flowerBridge.synchronize(uuid)
[Synchronize mode]
- Synchronize historic samples

**Kind**: instance method of <code>[FlowerBridge](#FlowerBridge)</code>

| Param | Type | Description |
| --- | --- | --- |
| uuid | <code>string</code> | The Uuid of the flower power |

<a name="FlowerBridge+live"></a>
### flowerBridge.live(uuid, options)
[Live mode]
- Show every second each data of a sensor

**Kind**: instance method of <code>[FlowerBridge](#FlowerBridge)</code>
**Default**: <code>options[delay] = 5</code>

| Param | Type | Description |
| --- | --- | --- |
| uuid | <code>string</code> | The Uuid of the flower power |
| options | <code>json</code> | `options[delay]` -> Delay of the live mode |

<a name="FlowerBridge+all"></a>
### flowerBridge.all(action, options)
Apply then `action` for **all** flower powers of your garden.
* `options[delay]` -> Do an action every `delay` minutes.
* `options[priority]` -> `array` of uuid: Do this action for these flower power **befor** the normal process.

**Kind**: instance method of <code>[FlowerBridge](#FlowerBridge)</code>

| Param | Type | Description |
| --- | --- | --- |
| action | <code>string</code> | The name of the function to apply. |
| options | <code>object</code> | Options to deal with all sensors. |

[![forthebadge](http://forthebadge.com/images/badges/built-with-love.svg)](http://forthebadge.com)
