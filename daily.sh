#!/bin/bash

CHECK_WORKDAY=true
WORKDAY_LENGTH=12	# hours
export CHECK_WORKDAY
export WORKDAY_LENGTH

cd /usr/OMbin/node/it_gonna_rain
node index.js
