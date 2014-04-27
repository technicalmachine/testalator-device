#!/bin/bash
createTunnel() {
  cd ~/testalator-device;
  ip=$(awk -F"=" '/ip/{print $2}' device)
  port=$(awk -F"=" '/port/{print $2}' device)
  /usr/bin/ssh -N -R $port:localhost:22 root@$ip
  if [[ $? -eq 0 ]]; then
    echo Tunnel to jumpbox created successfully
  else
    echo An error occurred creating a tunnel to jumpbox. RC was $?
  fi
}

echo Creating new tunnel connection
createTunnel
