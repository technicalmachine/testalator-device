#!/bin/bash
createTunnel() {
  cd ~/testalator-device;
  ip=$(awk -F"=" '/ip/{print $2}' device)
  port=$(awk -F"=" '/port/{print $2}' device)
  /usr/bin/autossh -R $port:localhost:22 -N root@$ip
}

echo Creating new tunnel connection
createTunnel

