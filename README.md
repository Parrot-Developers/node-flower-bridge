# Flower Bridge

[Tower Bridge - London](https://en.wikipedia.org/wiki/Tower_Bridge)

## How to install
`Node` >= 4.x

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
	"client_id": "...",
	"client_secret": "...",
	"username": "...",
	"password": "..."
}
```
And walk on the brigde.
:
```bash
$ ./run display		    : To have a output:
$ ./run background 	    : To run the program in background
$ ./run stop		    : To stop this program
$ ./run                 : To have help
```

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
    bridge.automatic();
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

##### Events
```js
'login' = {access_token, expires_in, refresh_token}
'info' = {message, date}
'error' = {message, date}
'newProcess' = {uuid, lastProcess, process, date}
```

##### Api
```js
// Login in to the Cloud
bridge.loginToApi(credentials [, callback]);   // event: 'login'

// Get your garden configuration
bridge.getUser(callback);

// Make an automatic syncronization
var options = {
	delay: 15,      // loop delay
	priority: [],   // add a 'uuid'
};
bridge.automatic([options]);

// Live for a Flower Power
bridge.live(uuid); // Comming soon !
```

## How it works
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
