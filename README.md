<h1>Flower Bridge</h1>

https://en.wikipedia.org/wiki/Tower_Bridge


<h2>How to install</h2>   
`Linux raspberrypi` >= 4.1.x   
`Node` >= 4.0.0   

This program works with any BLE-equipped/BLE-dongle-equipped computers as well.
To install it on your raspberry is really easy. You require Node (with npm) and BLE libraries.

First, you need a raspberry with a USB BLE dongle. This raspberry must be up and running.
Then you need to install some required tools on your raspberry.

<h3>Step 1: NodeJs</h3>

First, nodejs needs to be installed, proceed as following:
```bash
$ sudo apt-get update && sudo apt-get upgrade
$ curl --silent --location https://deb.nodesource.com/setup_4.x | sudo bash -
$ sudo apt-get install nodejs
```
	
Then do a `node --version` to check if it worked.

<h3>Step 2: BLE libraries</h3>
Then we need to install the BLE libraries:
```bash
$ sudo apt-get install libdbus-1-dev libdbus-glib-1-dev libglib2.0-dev libical-dev libreadline-dev libudev-dev libusb-dev glib2.0 bluetooth bluez libbluetooth-dev make
```

Okay now you should be able to discover peripheral around you.
The command `hciconfig` will be show your dongle (hci0). So:
```bash
$ sudo hciconfig hci0 up
```

To check if it worked, just do a `sudo hcitool lescan`, if it shows you a list of surrounding BLE devices – or at least your Flower Power -- it worked. If not, do a `sudo apt-get install bluez` and try again.

<h3>Step 3: Build the brigde</h3>
Now, if Nodejs and BLE libraries are installed, clone this repository and do:
```bash
$ ./configure
```

<h2>How to use it</h2>

To communicate with your Flower Powers, edit `credentials.json`:
```javascript
{
	"client_id": "...",
	"client_secret": "...",
	"username": "...",
	"password": "..."
}
```
And finaly, you can walk on the brigde.
:
```bash
$ sudo ./run background 	: To run the program in background
$ sudo ./run display		: To have a output:
$ sudo ./run stop			: To stop this program
```
More details:
```bash
$ sudo ./run
$ sudo ./updatedb
```

<h2>How it works</h2>
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
