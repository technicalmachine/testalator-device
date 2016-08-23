**[UNMAINTAINED] This library does not have a maintainer. The source code and repository will be kept at this URL indefinitely. If you'd like to help maintain this codebase, create an issue on this repo explaining why you'd like to become a maintainer and tag @tessel/maintainers in the body.**

#Testalator
test bench for Tessel


## Setting up a new device

* Aquire a Rpi

### install node

```
sudo apt-get upgrade; 
sudo apt-get update;
wget http://nodejs.org/dist/v0.10.2/node-v0.10.2-linux-arm-pi.tar.gz;
tar -xvzf node-v0.10.2-linux-arm-pi.tar.gz;
node-v0.10.2-linux-arm-pi/bin/node --version;
npm install -g node-gyp;
```

add it to the path

```
NODE_JS_HOME=/home/pi/node-v0.10.2-linux-arm-pi 
PATH=$PATH:$NODE_JS_HOME/bin
```

### set up the device name

```
touch device
```

Make sure device has something like 

```
device=<device name>
ip=162.243.26.105 #this is rampart
port=<reverse ssh  tunnel port>
ssid=<wifi ssid>
auth=<auth type>
pw=<wifi pw>
```

### install tessel stuff

```
sudo apt-get install libusb-1.0-0-dev libudev-dev;
```

```curl -sS https://tessel.io/install.sh | bash```

### set up cronjob
crontab -e
*/1 * * * * ~/testalator-device/heartbeat.sh > heartbeat.log 2>&1
*/1 * * * * ~/testalator-device/create_ssh_tunnel.sh > ssh_tunnel.log 2>&1
@reboot forever ~/testalator-device/testalator.js


### set up the ssh keys
```
cd ~/.ssh
ssh-keygen -t rsa
ssh-copy-id root@162.243.26.105
```

<!-- */1 * * * * root ~/testalator-device/heartbeat.sh -->
<!-- */1 * * * * root ~/testalator-device/create_ssh_tunnel.sh -->


### running

```
sudo $(which node) testalator.js
```
