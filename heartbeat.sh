#!/bin/sh
# on startup always ping testalator web
#. /home/pi/.bashrc
cd ~/testalator-device
device=$(awk -F"=" '/device/{print $2}' device)
ssh_ip=$(awk -F"=" '/ip/{print $2}' device)
port=$(awk -F"=" '/port/{print $2}' device)
ip=$(/sbin/ifconfig | awk -F':' '/inet addr/&&!/127.0.0.1/{split($2,_," ");print _[1]}')
gateway=$(/sbin/ip route | awk '/default/ { print $3 }')
build=$(git rev-parse HEAD)

# check out what this bench's device name is
echo '{"device":"'$device'", "ip":"'$ip'", "build":"'$build'", "gateway":"'$gateway'"}'
curl -H 'Content-Type: application/json' -d '{"name":"'$device'", "ip":"'$ip'", "gateway":"'$gateway'", "build": "'$build'", "ssh":"'$ssh_ip'", "port":"'$port'"}' testalator.herokuapp.com/bench
