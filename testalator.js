// uses the https://github.com/rakeshpai/pi-gpio lib
var gpio = require("pi-gpio");
var sys = require('sys'),
  exec = require('child_process').exec,
  async = require("async"),
  fs = require("fs")
  path = require('path'),
  humanize = require('humanize'),
  tessel_usb = require('./deps/cli/src/index.js'),
  usb = require('usb')
  ;

var A0 = 8,
  A6 = 10,
  A8 = 12,
  A7 = 21,
  button = 22,
  reset = 24,
  ledDfu = 7,
  ledFirmware = 11,
  ledJS = 13,
  ledPins = 15,
  ledWifi = 16,
  usbPwr = 18,
  ledDone = 19,
  ledError = 26,
  busy = 3,
  config = 5,
  extPwr = 23
  ;

// var tesselClient = require("./deps/cli/src/index"),
var  dfu = require("./deps/cli/dfu/tessel-dfu")
  ;

var TESSEL_VID = 0x1d50;
var TESSEL_PID = 0x6097;

var NXP_ROM_VID = 0x1fc9;
var NXP_ROM_PID = 0x000c;

var BOARD_V = 4;
var CC_VER = "1.24";

var tessel = null;

var otpPath = "./bin/tessel-otp-v4.bin",
  wifiPatchPath = "./bin/tessel-cc3k-patch.bin",
  firmwarePath = "./bin/tessel-firmware.bin",
  jsPath = "./bin/tessel-js.tar";

var network = "",
  pw = "",
  auth = "";

var needOTP = false;

var logger;
var deviceId; 

function setupLogger(next){
  var deviceSettings = require('./parser.js').create('device').process(['device', 'ssid', 'pw', 'auth'], function(res){
    network = res.ssid;
    pw = res.pw;
    auth = res.auth;
    exec('git rev-parse HEAD', function(err, git, stderr){
      fs.readdir('bin', function(err, files){
        logger = require('./logger.js').create(res.device, git, files);
        logger.clearDevice();
        next && next();
      });
    });
  });
}

function run(){
  console.log("running");
  needOTP = false;
  setupLogger(function (){
     async.waterfall([
      function (cb) { closeAll(cb) },
      function (cb) { setup(cb) },
      // function (cb) { checkOTP(cb)},
      // function (cb) { firmware(firmwarePath, cb) },
      // function (cb) { ram(wifiPatchPath, 13500, cb)},
      function (cb) { getBoardInfo(cb) },
      // function (cb) { wifiPatchCheck(cb) },
      function (cb) { jsCheck(jsPath, cb) },
      function (cb) { wifiTest(network, pw, auth, cb)}
    ], function (err, result){
      logger.writeAll("Finished.");
      
      setTimeout(function(){
        if (err){
          toggleLED(ledError, 1);
          logger.writeAll(logger.levels.error, "testalator", err);
          // console.log("Error, ", err);
        } else {
          // console.log("Success!", result);
          toggleLED(ledDone, 1);
          logger.writeAll("Success!");
        }

        setTimeout(function(){
          closeAll(function(){
            process.exit();
          });
        }, 500);
      }, 10000);
    });
  }); 
}

function wifiTest(ssid, pw, security, callback){
  logger.writeAll("wifi test");
  var count = 0;
  var maxCount = 1;

  // tessel_usb.findTessel(null, function(err, client){
    // if (err) {
      // console.log("err after firmware", err);
      // return callback(err);
    // }
    // console.log(tessel.serialNumber);

    var retry = function() {
      tessel.configureWifi(ssid, pw, security, {
        timeout: 8
      }, function (data) {

        if (!data.connected) {
          logger.writeAll(logger.levels.error, "wifiTest", "Retrying... #"+count);

          count++;
          if (count > maxCount) {
            logger.writeAll(logger.levels.error, "wifiTest", "wifi did not connect");
            logger.deviceUpdate("wifi", false);

            callback("wifi did not connect")
          } else {
            setImmediate(retry);
          }
        } else {
          logger.writeAll("connected on try #"+count+" with ip "+data.ip);

          exec("fping -c1 -t500 "+data.ip, function(error, stdout, stderr){
            if (!error){
              logger.deviceUpdate("wifi", true);
              logger.writeAll("wifi connected");

              toggleLED(ledWifi);

              callback(null);
            } else {
              logger.deviceUpdate("wifi", false);
              logger.writeAll(logger.levels.error,"wifi","wifi connected but could not ping: " +error);
              callback(error);
            }
          });
        }
      });
    }

    retry();
  // });

}

function ramTest(path, callback){
  setTimeout(function(){
    dfu.runRam(fs.readFileSync(path), function(){
      console.log("done with running ram");
      callback(null);
    });
  }, 1000);
}

function ram(path, delayLength, callback){
  // gpio.close(config, function (err) {
    // gpio.open(config, "output", function(err){
      gpio.write(config, 1, function(err){
        rst(function(err){
          logger.write("running ram patch on "+path);
          setTimeout(function(){

            dfu.runRam(fs.readFileSync(path), function(err){
              gpio.write(config, 0, function(){
                if (err) return callback(err);
                console.log("done with running ram");
                setTimeout(function(){
                  callback(null);
                }, delayLength);
              });
            });
          }, 1000);
        });
      });
    // });
  // });
}

function checkOTP(callback){
  logger.write("starting check OTP");

  emc(1, function(err) {
    if (err) return callback(err);
    rst(function(err){
      if (err) return callback(err);
      usbCheck(NXP_ROM_VID, NXP_ROM_PID, function(err){
        // if it is found otp
        if (!err) {
          needOTP = true;
          // console.log("this board should be otped");
          dfu.runNXP(otpPath, function(err){
            if (err) return callback(err);
            emc(0, function(err){
              setTimeout(function(){
                usbCheck(TESSEL_VID, TESSEL_PID, function(err){
                  if (err) {
                    logger.write(logger.levels.error, "checkOTP", "OTP'ed but cannot find tessel pid/vid");
                    // toggleLED(ledError, 1);
                    return callback(err);
                  }
                  logger.write("done with check OTP");
                  callback(null);
                });
              }, 1000);
            });
          });


        } else {
          // if it's not found check for other otp.
          usbCheck(TESSEL_VID, TESSEL_PID, function(err){
            if (err) {
              // otherwise it's an error
              logger.write(logger.levels.error, "checkOTP", "cannot find either nxp pid/vid or tessel pid/vid");
              // toggleLED(ledError, 1);
              
              return callback(err);
            }
            logger.write("already OTP'ed");
            callback(null);
          });
        }
      });
    });
  });
}

var hardwareResolve = require('hardware-resolve');

function jsCheck(path, callback){
  // tessel upload code

  // tessel_usb.findTessel(null, function (err, client) {

    // if (err){
      // logger.writeAll(logger.levels.error, "jsCheck", err);
      // return callback(err);
    // }

    // var tessel = client;


    var tarbundle = fs.readFileSync(path);
    tessel.deployBundle(tarbundle, {});
    console.log("done with bundling");
    // check for the script to finish
    tessel.listen(true);
    var turnOnLED = false;
    tessel.on('log', function (level, data) {
      if (!turnOnLED) {
        turnOnLED = true;
        toggleLED(ledJS, 1);
      }

      if (data[0] == '{' && data[data.length-1] == '}'){
        // console.log("got a command", level, data);
        data = JSON.parse(data);
        // check test status
        if (data.jsTest && data.jsTest == 'passed'){
          console.log("PASSED");
          logger.writeAll("jsTest passed");
          toggleLED(ledPins, 1);

          return callback();
        } else if (data.jsTest && data.jsTest == 'failed'){

          logger.writeAll(logger.levels.error, data.jsTest, "failed");
          // toggle led
          // toggleLED(ledError, 1);
          callback("Could not pass js test");
        } else {
          console.log("updating", Object.keys(data)[0], data[Object.keys(data)[0]]);
          logger.deviceUpdate(Object.keys(data)[0], data[Object.keys(data)[0]]);
        }
      } else {
        // push data into logging
        logger.writeAll( data);
      }
    });
  // });
}

function wifiPatchCheck(callback){
  logger.write("wifiPatchCheck beginning.");

  // wait 20 seconds, check for wifi version
  setTimeout(function(){
    // read wifi version
    var called = false;
    tessel.wifiVer(function(err, data){
      logger.writeAll("wifiPatchCheck", data);
      if (data == CC_VER) {
        logger.deviceUpdate("tiFirmware", true);
        called = true;
        callback(null);
      } else {
        logger.deviceUpdate("tiFirmware", false);
        logger.writeAll(logger.levels.error, "wifiVersion", data);
        called = true;
        callback("error, wifi patch did not update");
      }
    });

  }, 1000);
}

function testFirmware(path, callback){
  usbCheck(TESSEL_VID, TESSEL_PID, function(error, data){
    // console.log("error", error, "data", data);
    if (!error){
      // console.log("writing binary: ", path);

      logger.write("writing binary on "+path);
      console.log(fs.readdirSync("./bin"));
      require('./deps/cli/dfu/tessel-dfu').write(fs.readFileSync(path), function(err){
        console.log("done writing firmware");
      });
    }
  });
}

function firmware(path, callback){
  logger.write("starting firmware write on "+path);
  // config and reset

  function dfuFirmware(){
    usbCheck(TESSEL_VID, TESSEL_PID, function(error, data){
      // console.log("error", error, "data", data);
      if (!error){
        // console.log("writing binary: ", path);

        logger.write("writing binary on "+path);
        console.log(fs.readdirSync("./bin"));
        require('./deps/cli/dfu/tessel-dfu').write(fs.readFileSync(path), function(err){

          // make config low
          gpio.write(config, 0, function(){

            if (err){
              logger.write(logger.levels.error, "firmware", err);
              // toggleLED(ledError, 1);
              
              callback(err);
            } else {
              toggleLED(ledFirmware, 1);
              callback(null);
            }
          });

        });
      } else {
        logger.write(logger.levels.error, "firmware", err);
        callback(err);
      }
    });
  }

  if (!needOTP) {
    gpio.write(config, 1, function(err){
      rst(function(err){
        dfuFirmware();
      });
    });
  } else {
    dfuFirmware();
  }
}

function usbCheck(vid, pid, callback){
  setTimeout(function(){
    // console.log("checking usb for ", vid, pid);
    logger.write("checking usb for "+vid+"/"+pid);

    if (usb.findByIds(vid, pid)){
      logger.write("found vid/pid "+vid+"/"+pid);
      callback(null);
    } else {
      logger.write(logger.levels.error, "usb_check", "cannot find vid/pid: " + vid + " " + pid);
      callback("Error cannot find vid/pid: " + vid + " " + pid, "usb check");
    }
  }, 1000);
}

function rst(callback){
  // close it?
  logger.write("resetting Tessel");

  // gpio.close(reset, function (err){
    // gpio.open(reset, "output", function(err){
      gpio.write(reset, 0, function(err) {
        // wait a bit
        setTimeout(function() {
          gpio.write(reset, 1, function(err) {
            setTimeout(function() {
              logger.write("starting tessel back up");
              callback(null);
            }, 300);
            
          });
        }, 100);
      });
    // });
  // });
}

function toggleLED(led, state){
  // gpio.open(led, "output", function(err){
  gpio.write(led, state, function(err) {});
  // });
}

function getBoardInfo(callback) {
  logger.write("getting board info.");
  // find the serial and otp
  tessel_usb.findTessel(null, function(err, client){
    tessel = client;
    if (!err) {
      console.log(client.serialNumber);
      // console.log(client.version.firmware_git);
      // parse serial number, TM-00-04-f000da30-00514f3b-38642586 
      var splitSerial = client.serialNumber.split("-");
      if (splitSerial.length != 6){
        // error we got something that's not a serial number
        logger.write(logger.levels.error, "boardInfo", "got bad serial number: "+client.serialNumber);
        return callback("got bad serial number "+client.serialNumber );
      }

      var otp = splitSerial[2];
      console.log("otp", splitSerial[2]);
      var serial = splitSerial[3]+'-'+splitSerial[4]+'-'+splitSerial[5];
      logger.newDevice({"serial":serial, "firmware": client.version.firmware_git, "runtime": client.version.runtime_git, "board":otp});
      
      if (Number(otp) == BOARD_V){
        logger.deviceUpdate("otp", otp);
        toggleLED(ledDfu, 1);

      } else {
        logger.deviceUpdate("otp", false);
        logger.writeAll(logger.levels.error, "otpVersion", otp );
        // toggleLED(ledError, 1);

        return callback("OTP is set as "+otp);
      }

      return callback(null);
    } else {
      console.log("could not get board info");
      // toggleLED(ledError, 1);
      return callback(err);
    }
  });
}

function closeAll(callback){
  var funcArray = [];
  [A0, A6, A8, A7, button, reset, ledDfu, ledFirmware, 
  ledJS, ledPins, ledWifi, ledDone, ledError, busy, 
  config, usbPwr, extPwr].forEach(function(element){
    funcArray.push(function(cb){
      gpio.close(element, function(err){
        cb(err);
      })
    });
  })

  async.parallel(funcArray, function (err, res){
    callback(null);
  });
}

function setup(callback){
  // var pinArr = ;
  // // unexport everything
  // pinArr.forEach(function (pin){
  //   console.log("pin", pin);
  //   gpio.close(pin);
  // });
  logger.write("setting up...");
  var funcArray = [];
  [reset, ledDfu, ledFirmware, ledJS, ledPins, 
  ledWifi, ledDone, ledError, busy, config, reset, extPwr].forEach(function(element){
    funcArray.push(function(cb){
      gpio.open(element, "output", function(err){
        // gpio.close(element);
        if (element == reset || element == busy) {
          gpio.write(element, 1, function(err) {
            cb(err);
          });
        } else {
          gpio.write(element, 0, function(err) {
            cb(err);
          });
        }
      });
    });
  });
  

  var calledBack = false;
  
  // have all emcs be inputs
  emc(0, function(){
    // wait until a button is pressed.
    gpio.open(button, "input", function (err){
      logger.write("waiting for button press");

      var intervalId = setInterval(function(){
        gpio.read(button, function(err, value){
          if (value == 0 && calledBack == false) {
            clearInterval(intervalId);
            
            calledBack = true;
            // not ready anymore
            async.parallel(funcArray, function (err, results){
              logger.write("done with setting up");
              gpio.write(busy, 0, function(){
                callback();
              });
            });

          }
        });
      }, 20);
    });
  });
    
}

function emc(enable, callback){
  var maxNum = 4, 
    count = 0,
    pinArray = {};

  pinArray[A0] = 0;
  pinArray[A6] = 1;
  pinArray[A7] = 0;
  pinArray[A8] = 1;

  // console.log("pin array", pinArray);
  logger.write("setting up external memory controller pins");

  if (enable){
    // open up EMC pins and toggle for DFU mode
    Object.keys(pinArray).forEach(function(pin){
      // gpio.close(pin, function (err){
        gpio.open(pin, "output", function(err){
          // TODO: all except one should be low
          gpio.write(pin, pinArray[pin], function(err) {
            count++;
            if (count >= maxNum){
              callback(null);
            }
          });
        });
      // });
    });
  } else {
    // close up all EMC pins
    Object.keys(pinArray).forEach(function(pin){
      // gpio.close(pin, function (err){
        gpio.open(pin, "input", function(err) {
          count++;
          if (count >= maxNum){
            logger.write("set emc pins as inputs");
            callback(null);
          }
        });
      // });
    });
  }
}

run();

function exit() {
  closeAll(function(err){
    // exit for real
    process.exit();
  });
}

process.on('SIGINT', exit);
