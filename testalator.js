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
  ledDone = 19,
  ledError = 26,
  busy = 3,
  powerCycle = 18,
  config = 5,
  resetBottom = 23
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


// var otpPath = "./bin/tessel-otp-v3.bin",
var otpPath = "",
  wifiPatchPath = "./bin/tessel-cc3k-patch.bin",
  firmwarePath = "./bin/tessel-firmware.bin",
  jsPath = "./tessel/tesselatee/index.js";
  // jsPath = "blinky.js";

var network = "GreentownGuest",
  pw = "welcomegtl",
  auth = "wpa2";


var logger;
var deviceId; 

function setupLogger(next){
  var deviceSettings = require('./parser.js').create('device').process(['device'], function(res){
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

  setupLogger(function (){
     async.waterfall([
      // function (cb) { setup(cb) },
      // function (cb) { emc(1, cb) },
      // function (cb) { rst(cb) },
      // function (cb) { usbCheck(NXP_ROM_VID, NXP_ROM_PID, cb) },
      // function (cb) { ram(otpPath, cb) },
      // function (cb) { emc(0, cb) },
      // function (cb) { rst(cb) },
      // function (cb) { usbCheck(TESSEL_VID, TESSEL_PID, cb) },
      // function (cb) { firmware(firmwarePath, cb) },
      // function (cb) { getBoardInfo(cb) },
      // function (cb) { ram(wifiPatchPath, cb)},
      // function (cb) { wifiPatchCheck(cb) },
      function (cb) { jsCheck(jsPath, cb) },
      // function (cb) { wifiTest(network, pw, auth, cb)}
    ], function (err, result){
      logger.writeAll("Finished.");

      if (err){
        errorLed();
        logger.writeAll(logger.levels.error, "testalator", err);
        // console.log("Error, ", err);
      } else {
        // console.log("Success!", result);
        logger.writeAll("Success!");
      }

      process.exit();
    });
  }); 
}

function wifiTest(ssid, pw, security, callback){
  logger.writeAll("wifi test");
  var count = 0;
  var maxCount = 10;

  tessel_usb.findTessel(null, function(err, client){
    if (err) {
      console.log("err after firmware", err);
      return callback(err);
    }
    console.log(client.serialNumber);

    var retry = function() {
      client.configureWifi(ssid, pw, security, {
        timeout: 8
      }, function (data) {

        if (!data.connected) {
          logger.writeAll(logger.levels.error, "wifiTest", "Retrying... #"+count);

          count++;
          if (count > maxCount) {
            logger.writeAll(logger.levels.error, "wifiTest", "wifi did not connect");

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

              gpio.close(ledWifi, function (err){
                gpio.open(ledWifi, "output", function(err){
                  gpio.write(ledWifi, 1, function(err) {
                  });
                });
              });

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
  });

}

function ram(path, callback){
  // console.log("path", path);
  logger.write("running ram patch on "+path);
  gpio.close(config, function (err) {
    gpio.open(config, "output", function(err){
      gpio.write(config, 1, function(err){
        rst(function(err){

          setTimeout(function(){
            dfu.runRam(fs.readFileSync(path), function(){
              console.log("done with running ram");
              callback(null);
            });
          }, 1000);
        });
      });
    });
  });
}


var hardwareResolve = require('hardware-resolve');

function bundle (arg, opts)
{
  function duparg (arr) {
    var obj = {};
    arr.forEach(function (arg) {
      obj[arg] = arg;
    })
    return obj;
  }

  var ret = {};

  hardwareResolve.root(arg, function (err, pushdir, relpath) {
    var files;

    ret.warning = String(err || 'Warning.').replace(/\.( |$)/, ', pushing just this file.');

    pushdir = path.dirname(fs.realpathSync(arg));
    relpath = path.basename(arg);
    files = duparg([path.basename(arg)]);


    ret.pushdir = pushdir;
    ret.relpath = relpath;
    ret.files = files;

    // Update files values to be full paths in pushFiles.
    Object.keys(ret.files).forEach(function (file) {
      ret.files[file] = fs.realpathSync(path.join(pushdir, ret.files[file]));
    })
  })

  // Dump stats for files and their sizes.
  var sizelookup = {};
  Object.keys(ret.files).forEach(function (file) {
    sizelookup[file] = fs.lstatSync(ret.files[file]).size;
    var dir = file;
    do {
      dir = path.dirname(dir);
      sizelookup[dir + '/'] = (sizelookup[dir + '/'] || 0) + sizelookup[file];
    } while (path.dirname(dir) != dir);
  });

  ret.size = sizelookup['./'] || 0;

  return ret;
}

function jsCheck(path, callback){
  // tessel upload code

  tessel_usb.findTessel(null, function (err, client) {

    if (err){
      logger.writeAll(logger.levels.error, "jsCheck", err);
      return callback(err);
    }

    var ret = bundle(path);
    if (ret.warning) {
      logger.writeAll(logger.levels.warning, "jsCheck", ret.warning);
      console.error(('WARN').yellow, ret.warning.grey);
    }
    console.error(('Bundling directory ' + ret.pushdir + ' (~' + humanize.filesize(ret.size) + ')').grey);
    logger.writeAll("bundling"+ ret.pushdir+ ' (~' + humanize.filesize(ret.size) + ')');

    tessel_usb.bundleFiles(ret.relpath, {}, ret.files, function (err, tarbundle) {
      // console.error(('Deploying bundle (' + humanize.filesize(tarbundle.length) + ')...').grey);
      if (err){
        logger.writeAll(logger.levels.error, "jsCheck", err);
        errorLed();
        callback(err);
      } else {
        gpio.close(ledJS, function (err){
          gpio.open(ledJS, "output", function(err){
            gpio.write(ledJS, 1, function(err) {
            });
          });
        });
      }
      client.deployBundle(tarbundle, {});
      console.log("done with bundling");
      // check for the script to finish
      client.on('command', function (command, data, debug) {
        console.log("got a command", command, data, debug);
        if (command == "s" && data[0] == '{' && data[data.length-1] == '}'){
          data = JSON.parse(data);
          // check test status
          if (data.jsTest && data.jsTest == 'passed'){

            logger.writeAll(data.jsTest + " passed");
            // toggle led
            gpio.close(ledPins, function (err){
              gpio.open(ledPins, "output", function(err){
                gpio.write(ledPins, 1, function(err) {
                  callback();
                });
              });
            });
          } else if (data.jsTest && data.jsTest == 'failed'){

            logger.writeAll(logger.levels.error, data.jsTest, "failed");
            // toggle led
            errorLed();
          } else {
            logger.deviceUpdate(Object.keys(data)[0], data[Object.keys(data)[0]]);
          }
        } else if (command == "s" ){
          // push data into logging
          logger.writeAll("jsTest", data);
        }
      });
    });
  });
}

function wifiPatchCheck(callback){
  logger.write("wifiPatchCheck");
  // wait 20 seconds, check for wifi version
  setTimeout(function(){
    // read wifi version
    logger.write("wifiPatchCheck beginning. set timeout for 20 seconds.");

    tessel_usb.findTessel(null, function (err, client) {

      logger.write("found tessel");

      var called = false;
      client.wifiVer(function(err, data){
        console.log("wifi version check", data);
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
    });

  }, 20000);
}

function firmware(path, callback){
  logger.write("starting firmware write on "+path);
  // config and reset
  gpio.close(config, function (err) {
    gpio.open(config, "output", function(err){
      gpio.write(config, 1, function(err){
        rst(function(err){

          usbCheck(TESSEL_VID, TESSEL_PID, function(error, data){
            // console.log("error", error, "data", data);
            if (!error){
              // console.log("writing binary: ", path);

              logger.write("writing binary on "+path);
              console.log(fs.readdirSync("./bin"));
              require('./deps/cli/dfu/tessel-dfu').write(fs.readFileSync(path), function(err){
                // console.log("did we get an err?", err);
                if (err){
                  logger.write(logger.levels.error, "firmware", err);
                  errorLed();
                } else {
                  gpio.close(ledFirmware, function (err){
                    gpio.open(ledFirmware, "output", function(err){
                      gpio.write(ledFirmware, 1, function(err) {
                        
                      });
                    });
                  });
                }

                callback(err);

              });
            } else {
              logger.write(logger.levels.error, "firmware", err);
              callback(err);
            }
          });
        });
      });
    });
  });
}



function usbCheck(vid, pid, callback){
  setTimeout(function(){
    // console.log("checking usb for ", vid, pid);
    logger.write("checking usb for "+vid+"/"+pid);

    if (usb.findByIds(vid, pid)){
      logger.write("found vid/pid "+vid+"/"+pid);
      callback(null);
    } else {
      callback("Error cannot find vid/pid: " + vid + " " + pid, "usb check");
    }
  }, 1000);
}

function rst(callback){
  // close it?
  logger.write("resetting Tessel");

  gpio.close(reset, function (err){
    gpio.open(reset, "output", function(err){
      gpio.write(reset, 0, function(err) {
        // wait a bit
        setTimeout(function() {
          gpio.write(reset, 1, function(err) {
            logger.write("starting tessel back up");
            callback(err);
          });
        }, 100);
      });
    });
  });
}

function errorLed(){
  gpio.close(ledError, function (err){
    gpio.open(ledError, "output", function(err){
      gpio.write(ledError, 1, function(err) {
        
      });
    });
  });
}

function getBoardInfo(callback) {

  logger.write("getting board info");
  setTimeout(function(){
    // find the serial and otp
    tessel_usb.findTessel(null, function(err, client){
      if (!err) {
        console.log(client.serialNumber);
        // parse serial number, TM-00-04-f000da30-00514f3b-38642586 
        var splitSerial = client.serialNumber.split("-");
        if (splitSerial.length != 6){
          // error we got something that's not a serial number
          logger.write(logger.levels.error, "boardInfo", "got bad serial number: "+client.serialNumber);
          return callback("got bad serial number "+client.serialNumber );
        }

        var otp = splitSerial[2];
        var serial = splitSerial[3]+'-'+splitSerial[4]+'-'+splitSerial[5];
        logger.newDevice({"serial":serial, "firmware": "", "runtime": "", "board":otp});
        
        if (Number(otp) == BOARD_V){
          logger.deviceUpdate("otp", true);

          gpio.close(ledDfu, function (err){
            gpio.open(ledDfu, "output", function(err){
              gpio.write(ledDfu, 1, function(err) {
                
              });
            });
          });
          callback(null);
        } else {
          logger.deviceUpdate("otp", false);
          logger.writeAll(logger.levels.error, "otpVersion", otp );
          errorLed();
          callback("OTP is set as "+otp);
        }
      } else {
        console.log("err after firmware", err);
      }
    });
  }, 1000);
}

function closeAll(callback){
  var funcArray = [];
  [A0, A6, A8, A7, button, reset, ledDfu, ledFirmware, 
  ledJS, ledPins, ledWifi, ledDone, ledError, busy, 
  powerCycle, config, resetBottom].forEach(function(element){
    funcArray.push(function(cb){
      gpio.close(element, function(err){
        cb(err);
      })
    });
  })

  async.parallel(funcArray, function (err, res){
    if (err){
      console.log("couldn't close pin", err);
      callback(err);
    } else{
      callback(null);
    }
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
  ledWifi, ledDone, ledError, busy, config, reset].forEach(function(element){
    funcArray.push(function(cb){
      gpio.open(element, "output", function(err){
        // gpio.close(element);
        if (element == reset) {
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

  closeAll(function(err){
    async.parallel(funcArray, function (err, results){
      // if (err){
        // logger.write("couldn't setup pin", err);
        // callback();
      // }

      // wait until a button is pressed.
      gpio.open(button, "input", function (err){
        logger.write("waiting for button press");

        var intervalId = setInterval(function(){
          gpio.read(button, function(err, value){
            if (value == 1 ) {
              clearInterval(intervalId);
              logger.write("done with setting up");
              callback();
            }
          });
        }, 20);
      });
    });
  });
}

function emc(enable, callback){
  var maxNum = 4, 
    count = 0,
    totalErr = null,
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
      console.log("emc", pin);
      gpio.open(pin, "output", function(err){
        // TODO: all except one should be low
        gpio.write(pin, pinArray[pin], function(err) {
          totalErr = totalErr || err;
          count++;
          if (count >= maxNum){
            callback(err);
          }
        });
      });
    });
  } else {
    // close up all EMC pins
    Object.keys(pinArray).forEach(function(pin){
      gpio.close(pin, function (err){
        gpio.open(pin, "input", function(err) {
          totalErr = totalErr || err;
          count++;
          if (count >= maxNum){
            logger.write("set emc pins as inputs");
            callback(err);
          }
        });
      })
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
