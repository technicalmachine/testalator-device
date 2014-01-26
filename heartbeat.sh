#!/bin/sh
# on startup always ping testalator web
cd ~/testalator-device
ip=$(/sbin/ifconfig | awk -F':' '/inet addr/&&!/127.0.0.1/{split($2,_," ");print _[1]}')
gateway=$(/sbin/ip route | awk '/default/ { print $3 }')
build=$(git rev-parse HEAD)

# check out what this bench's device name is
echo '{"device":"'$DEVICE'", "ip":"'$ip'", "build":"'$build'", "gateway":"'$gateway'"}'
curl -H 'Content-Type: application/json' -d '{"name":"'$DEVICE'", "ip":"'$ip'", "gateway":"'$gateway'", "build": "'$build'"}' testalator.herokuapp.com/bench