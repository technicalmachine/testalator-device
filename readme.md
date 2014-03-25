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
ip=162.243.26.105
port=<reverse ssh  tunnel port>
```

### install tessel stuff

```curl http://tessel.io/install.sh | sudo sh```

### set up cronjob
crontab -e
*/1 * * * * root ~/testalator-device/heartbeat.sh > heartbeat.log 2>&1
*/1 * * * * root ~/testalator-device/create_ssh_tunnel.sh > ssh_tunnel.log 2>&1
