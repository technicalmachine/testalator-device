// uses the https://github.com/rakeshpai/pi-gpio lib
var gpio = require("pi-gpio");
var sys = require('sys'),
  exec = require('child_process').exec,
  async = require("async"),
  fs = require("fs"),
  usb = require('usb'),
  path = require('path'),
  humanize = require('humanize')
  ;

var A0 = 8,
  A6 = 10,
  A8 = 12,
  A7 = 21,
  button = 22,
  reset = 24,
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

var tesselClient = require("./deps/cli/src/index.js"),
  dfu = require("./deps/cli/dfu/tessel-dfu.js")
  ;

var TESSEL_VID = 0x1d50;
var TESSEL_PID = 0x6097;

var NXP_ROM_VID = 0x1fc9;
var NXP_ROM_PID = 0x000c;

// var otpPath = "./bin/tessel-otp-v3.bin",
var otpPath = "./bin/tm_otp_v02.bin",
  wifiPatchPath = "./bin/tessel-firmware.bin",
  firmwarePath = "./bin/tessel-firmware.bin",
  jsPath = "./tessel/tesselatee/index.js";

var network = "GreentownGuest",
  pw = "welcomegtl",
  auth = "wpa2";


function run(){
  console.log("running");
  async.waterfall([
    // function (cb) { setup(cb) },
    // function (cb) { emc(1, cb) },
    // function (cb) { rst(cb) },
    // function (cb) { usbCheck(NXP_ROM_VID, NXP_ROM_PID, cb) },
    // function (cb) { ram(otpPath, cb) },
    // function (cb) { emc(0, cb) },
    // function (cb) { rst(cb) },
    // function (cb) { usbCheck(TESSEL_VID, TESSEL_PID, cb) },
    // function (cb) { ram(wifiPatchPath, cb)}
    // function (cb) { wifiPatchCheck(cb) },
    // function (cb) { firmware(firmwarePath, cb) },
    // function (cb) { jsCheck(jsPath, cb) },
    function (cb) { wifiTest(network, pw, auth, cb)}
  ], function (err, result){
    console.log("res called");
    if (err){
      console.log("Error, ", err);
    } else {
      console.log("Success!", result);
    }

    process.exit();
  });
}

function wifiTest(ssid, pw, security, callback){
  console.log("wifi test");

  tesselClient.selectModem(function notfound () {
    console.error("No tessels found");
  }, function found (err, modem) {
    tesselClient.connectServer(modem, function () {

      var client = tesselClient.connect(6540, 'localhost');

      var maxCount = 5;
      var count = 0;
      // tessel wifi connect
      var retry = function() {

        client.configureWifi(ssid, pw, security, {
          timeout: 8
        }, function (err, data) {
          console.log(data);
          if (err) {
            console.error('Retrying...');
            count++;
            if (count > maxCount) {
              callback("wifi did not connect")
            }
            else {
              console.log("call reset forever");
              setImmediate(retry);
            }
          } else {
            // ping that ip to check
            exec("fping -c1 -t500 "+data.ip, function(error, stdout, stderr){
              if (!error){
                callback(null);
              } else {
                callback(error);
              }
            });
          }
        });
      }

      retry();

    });
  });
}

function bundle (arg)
{
  var hardwareResolve = require('hardware-resolve');
  var effess = require('effess');

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
    if (!pushdir) {
      if (fs.lstatSync(arg).isDirectory()) {
        ret.warning = String(err).replace(/\.( |$)/, ', pushing just this directory.');

        pushdir = fs.realpathSync(arg);
        relpath = fs.lstatSync(path.join(arg, 'index.js')) && 'index.js';
        files = duparg(effess.readdirRecursiveSync(arg, {
          inflateSymlinks: true,
          excludeHiddenUnix: true
        }))
      } else {
        ret.warning = String(err).replace(/\.( |$)/, ', pushing just this file.');

        pushdir = path.dirname(fs.realpathSync(arg));
        relpath = path.basename(arg);
        files = duparg([path.basename(arg)]);
      }
    } else {
      // Parse defaults from command line for inclusion or exclusion
      var defaults = {};
      // if (typeof argv.x == 'string') {
      //   argv.x = [argv.x];
      // }
      // if (argv.x) {
      //   argv.x.forEach(function (arg) {
      //     defaults[arg] = false;
      //   })
      // }
      // if (typeof argv.i == 'string') {
      //   argv.i = [argv.i];
      // }
      // if (argv.i) {
      //   argv.i.forEach(function (arg) {
      //     defaults[arg] = true;
      //   })
      // }

      // Get list of hardware files.
      files = hardwareResolve.list(pushdir, null, null, defaults);
      // Ensure the requested file from command line is included, even if blacklisted
      if (!(relpath in files)) {
        files[relpath] = relpath;
      }
    }

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

  // if (argv.verbose) {
  //   Object.keys(sizelookup).sort().forEach(function (file) {
  //     console.error('LOG'.cyan.blueBG, file.match(/\/$/) ? ' ' + file.underline : ' \u2192 ' + file, '(' + humanize.filesize(sizelookup[file]) + ')');
  //   });
  //   console.error('LOG'.cyan.blueBG, 'Total file size:', humanize.filesize(sizelookup['./'] || 0));
  // }
  ret.size = sizelookup['./'] || 0;

  return ret;
}

function jsCheck(path, callback){
  // tessel upload code
  tesselClient.selectModem(function notfound () {
    callback("Error, no device found");
  }, function found (err, modem) {
    tesselClient.connectServer(modem, function () {
      var client = tesselClient.connect(6540, 'localhost');
      // require("./deps/cli/bin/tessel.js").pushCode(path, null, client, null);
      // client.on('command', function (command, data, debug) {
      //   console.log(debug ? command.grey : command.red, data);
      //   // todo: send the callback

      // });
      var ret = bundle(path);
      if (ret.warning) {
        console.error(('WARN').yellow, ret.warning.grey);
      }
      console.error(('Bundling directory ' + ret.pushdir + ' (~' + humanize.filesize(ret.size) + ')').grey);

      tesselClient.bundleFiles(ret.relpath, null, ret.files, function (err, tarbundle) {
        console.error(('Deploying bundle (' + humanize.filesize(tarbundle.length) + ')...').grey);
        client.deployBundle(tarbundle, {});

        // do some stuff here?
      })
    });
  });
}

function wifiPatchCheck(callback){
  // wait 10 seconds, check for wifi version
  // setTimeout(function(){
    // rst(function(){
      // give device a little time to boot
      setTimeout(function(){
        // read wifi version
        tesselClient.selectModem(function notfound () {
          callback("Error, no device found");
        }, function found (err, modem) {
          tesselClient.connectServer(modem, function () {
            console.log("connected");
            var client = tesselClient.connect(6540, 'localhost');
            var called = false;
            client.on('command', function (command, data, debug) {
              if (command == "W" && data.cc3000firmware && !called){
                // get the json
                if (data.cc3000firmware == "1.10"){
                  called = true;
                  callback(null);
                } else if (data.cc3000firmware == "1.00"){
                  called = true;
                  callback("error, wifi patch did not update");
                }
              } 
            });
          });
        });

      }, 2000);
    // });
  // }, 10000);
}

function firmware(path, callback){
  // config and reset
  // gpio.write(config, 0, function(err){
    // rst(function(err){
      usbCheck(TESSEL_VID, TESSEL_PID, function(error, data){
        console.log("error", error, "data", data);
        console.log("writing binary: ", path);
        console.log(fs.readdirSync("./bin"));
        require('./deps/cli/dfu/tessel-dfu').write(fs.readFileSync(path), function(err){
          // console.log("did we get an err?", err);
          callback(null);

        });
      });
    // });
  // });    
}

function ram(path, callback){
  console.log("path", path);
  dfu.runRam(fs.readFileSync(path), function(){
    callback(null);
  });
}

function usbCheck(vid, pid, callback){
  setTimeout(function(){
    console.log("checking usb for ", vid, pid);
    if (usb.findByIds(vid, pid)){
      callback(null);
    } else {
      callback("Error cannot find vid/pid: " + vid + " " + pid, "usb check");
    }
  }, 1000);
}

function rst(callback){
  // close it?
  gpio.close(reset, function (err){
    gpio.open(reset, "output", function(err){
      gpio.write(reset, 0, function(err) {
        // wait a bit
        setTimeout(function() {
          gpio.write(reset, 1, function(err) {
            callback(err);
          });
        }, 100);
      });
    });
  });
  
}

function closeAll(callback){
  var funcArray = [];
  [A0, A6, A8, A7, button, reset, ledFirmware, 
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

  var funcArray = [];
  [reset, ledFirmware, ledJS, ledPins, 
  ledWifi, ledDone, ledError, busy].forEach(function(element){
    funcArray.push(function(cb){
      gpio.open(element, "output", function(err){
        // gpio.close(element);
        cb(err);
      });
    });
  });

  closeAll(function(err){
    async.parallel(funcArray, function (err, results){
      if (err){
        console.log("couldn't setup pin", err);
        callback(err);
      }

      // wait until a button is pressed.
      gpio.open(button, "input", function (err){
        var intervalId = setInterval(function(){
          gpio.read(button, function(err, value){
            if (value == 1 ) {
              clearInterval(intervalId);
              callback(err);
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

  console.log("pin array", pinArray);
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