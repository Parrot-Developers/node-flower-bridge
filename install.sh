#!/bin/bash

sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
(git clone -b v2 https://github.com/Parrot-Developers/node-flower-power && cd node-flower-power && npm install)
(git clone -b v2 https://github.com/Parrot-Developers/node-flower-power-cloud && cd node-flower-power-cloud && npm install)
npm install
