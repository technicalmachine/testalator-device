#Testalator
test bench for Tessel


## Setting up a new device

* Aquire a Rpi

### install node

### set up the device name
```
vi /etc/environment
```

add a line `DEVICE="<device name>"`

### install tessel stuff

```curl http://tessel.io/install/linux.sh | sudo sh```

### set up cronjob
crontab -e
*/1 * * * * root ~/testalator-device/heartbeat.sh > heartbeat.log 2>&1


### change the path of the npm install

make a file in home called `.npmrc`
`PREFIX=/home/pi/.npm-packages`

* device detected
* loaded first stage
* loaded code
* tessel booted
* wifi firmware updated

* test gpios
* test adcs
* test spi
* test i2c
* test uart
* ram spot check
* js code upload
* wifi connecting
* wifi code upload

* loaded first stage
* loaded final code
* done