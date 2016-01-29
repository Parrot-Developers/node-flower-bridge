#!/bin/bash
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
npm install
