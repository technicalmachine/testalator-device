// this script goes on the tessel being tested
var tessel = require('tessel');
var hw = process.binding('hw');

var addr = 0x2A;
var ports = {
  'A': tessel.port('A'),
  'B': tessel.port('B'),
  'C': tessel.port('C'),
  'D': tessel.port('D'),
  'G': tessel.port('GPIO')
  };

var PIN_TEST = 0x11,
    SCK_TEST = 0x21,
    SCK_PORT = 0x22,
    SCK_READ = 0x23,
    ADC_TEST = 0x31,
    DAC_TEST = 0x41,
    DAC_READ = 0x42,
    I2C_TEST = 0x51,
    OK = 0x0F
    ;

var i2c = new ports['A'].I2C(addr);
var i2c_0 = new ports['C'].I2C(addr); // the other i2c port

function checkOk(data){
  if (data[0] != OK) {
    console.log("{\"error\": \"cannot establish comms with Testalator\"}")
    return false;
  }
  return true;
}

function pinTest(next){
  console.log("===== pin test =====");
  var passing = 0;
  var failing = 0;
  var resString = "PIN TEST: ";
  i2c.transfer(new Buffer([PIN_TEST, 0x00]), 1, function(err, data) {
    // console.log("got data", data);
    // console.log("sent pin test cmd", PIN_TEST, " got response ", data);
    if (!checkOk(data)) {
      console.log("{\"pin\": \"failed\"}");
      return next && next("no comms", failed);
    }
    // look through all the gpios
    var numDone = 0;
    Object.keys(ports).forEach(function(port){

      // send over the port
      var max_gpios = 3;
      if (port == 'G') {
        max_gpios = 6;
      }
      for (var i = 1; i <= max_gpios; i++) {
        var pin = ports[port].gpio(i).input();
        if (pin.read() != 0){
          console.log("FAIL: pin ", pin.pin, " on port ", port, " is not low");
          resString = resString.concat("x");
          failing = failing + 1;
        } else {
          console.log("PASS: pin ", pin.pin, " on port ", port);
          resString = resString.concat(".");
          passing = passing + 1;
        }
        if (numDone >= 17) {
          if (passing >= 17) {
            console.log("Passed Pin Test");
            console.log("{\"pin\": \"passed\"}");
          } else {
            console.log("{\"pin\": \"failed\"}");
          }
          console.log("===== pin test: DONE ", passing, "passing ", failing, " failing =====");
          next && next(resString, failing);
        } 
        numDone = numDone +1;
      }
    });
    
  });
}

function individualSckTest(spi, port, next) {
  var passing = false;
  i2c.send(new Buffer([SCK_PORT, port]), function(port_err) {
    spi.transferSync(new Buffer([0xAA]));
    // console.log("done with spi transfer");
    // read back how many ports the slave read
    i2c.transfer(new Buffer([SCK_PORT, SCK_READ]), 2, function(read_err, read_data){
      var portAscii = String.fromCharCode(port);
      if (read_data[1] != 16){
        console.log("FAIL: sck is", read_data[1], "on port", portAscii);
      } else {
        console.log("PASS: sck on port", portAscii, "read", read_data[1]);
        passing = true;
      }
      next && next(passing);
    });
  });
}

function sckTest(next) {
  console.log("===== sck test =====");
  var sckPorts = Object.keys(ports);
  var count = 0;
  var passed = 0;
  var failed = 0;
  var resString = "SCK TEST: ";

  i2c.transfer(new Buffer([SCK_TEST, 5]), 2, function(err, data) {
    if (!checkOk(data)) {
      console.log("{\"sck\": \"failed\"}");
      return next && next("no comms", failed);
    }
    console.log("sent sck test cmd", SCK_TEST, " got response", data);
    function iterate() {
      // console.log("count", count, sckPorts[count], sckPorts.length);
      var spi = ports[sckPorts[count]].SPI({clockSpeed:100});
      individualSckTest(spi, sckPorts[count].charCodeAt(0), function(passing){
        if (passing){
          resString = resString.concat(".");
          passed += 1
        } else {
          resString = resString.concat("x");
          failed += 1;
        }
        if (count >= (sckPorts.length-1)){
          if (passed >= 4){
            console.log("Passed SCK test");
            console.log("{\"sck\": \"passed\"}");
          } else {
            console.log("{\"sck\": \"failed\"}");
          }
          console.log("===== sck test: DONE ", passed, "passing", failed, " failing =====");
          next && next(resString, failed);
        } else {
          count += 1;
          iterate();
        }
      });
    }

    iterate();
  });
}


function adcTest(next){
  console.log("===== adc test =====");
  var passed = 0;
  var failed = 0;
  var resString = "ADC TEST: ";

  i2c.transfer(new Buffer([ADC_TEST, 0x00]), 1, function(err, data) {
    if (!checkOk(data)) {
      console.log("{\"adc\": \"failed\"}");
      return next && next("no comms", failed);
    }
    
    console.log("sent adc test cmd", ADC_TEST, " got response ", data);
    for (var i = 1; i < 7; i++) {
      var val = ports['G'].analog(i).read();
      console.log("read ", val, " from analog pin ", i);
      if (val < 450 || val > 600) {
        console.log("FAIL: value of analog pin ", i, " is wrong: ", val);
        resString = resString.concat("x");
        failed += 1;
      } else {
        console.log("PASS: analog pin ", i, val);
        resString = resString.concat(".");
        passed += 1;
      }
    }
    if (passed >= 6) {
      console.log("Passed ADC test");
      console.log("{\"adc\": \"passed\"}");
    } else {
      console.log("{\"adc\": \"failed\"}");
    }
    console.log("===== adc test: DONE ", passed, "passed", failed, " failed =====");
    next && next(resString, failed);
  });
}

function dacTest(next){
  console.log("===== dac test =====");
  ports['G'].analog(1).write(512);
  var passed = 0;
  var failed = 0;
  var resString = "DAC TEST: ";

  i2c.transfer(new Buffer([DAC_TEST, 0x00]), 5, function(err, data) {
    if (!checkOk(data)) {
      console.log("{\"dac\": \"failed\"}");
      return next && next("no comms", failed);
    } 

    console.log("sent dac test cmd", DAC_TEST, " got response ", data);
    var dac_data = (data[1] << 24) + (data[2] << 16) + (data[3] << 8) + data[4]; 
    console.log("getting back dac read ", dac_data);
    if (dac_data < 450 || dac_data > 600){
      // we faillled
      console.log("FAIL: dac might be sending the wrong value. got this ", dac_data);
      resString = resString.concat("x");
      failed += 1;
    } else {
      console.log("PASS: dac passed", dac_data);
      resString = resString.concat(".");
      passed += 1;
    }
    if (passed >= 1){
      console.log("Passed DAC test");
      console.log("{\"dac\": \"passed\"}");
    } else {
      console.log("{\"dac\": \"failed\"}");
    }
    console.log("===== dac test: DONE ", passed, "passing", failed, " failing =====");
    next && next(resString, failed);
  });
}

function i2cTest(next){
  console.log("===== i2c test =====");
  var passed = 0;
  var failed = 0;
  var resString = "I2C TEST: ";

  i2c.transfer(new Buffer([I2C_TEST, 0x00]), 1, function(err, data){
    if (!checkOk(data)) {
      console.log("{\"i2c\": \"failed\"}");
      return next && next("no comms", failed);
    }

    i2c.disable();
    i2c_0.transfer(new Buffer([I2C_TEST, 0x00]), 1, function(err, data){
      if (data[0] == OK){
        console.log("PASS: I2C_0");
        console.log("{\"i2c\": \"passed\"}");
        resString = resString.concat(".");
        passed += 1;
      } else {
        console.log("FAIL: got this", data, "from I2C_0");
        console.log("{\"i2c\": \"failed\"}");
        resString = resString.concat("x");
        failed += 1;
      }
      console.log("===== i2c test: DONE ", passed, "passing", failed, " failed =====");
      i2c_0.disable();
      next && next(resString, failed);
    });
  });
}

var led1 = tessel.led(1).output().high();
var led2 = tessel.led(2).output().high();

console.log("executing tests");

pinTest(function(pinRes, pinFail){
  led1.toggle();
  sckTest(function(sckRes, sckFail){
    led1.toggle();
    led2.toggle();

    adcTest(function(adcRes, adcFail){
      led1.toggle();
      led2.toggle();

      dacTest(function(dacRes, dacFail){
        led1.toggle();
        led2.toggle();

        i2cTest(function(i2cRes, i2cFail){
          led1.toggle();
          led2.toggle();

          console.log("======= FINISHED ALL TESTS =======");
          console.log(pinRes);
          console.log(sckRes);
          console.log(adcRes);
          console.log(dacRes);
          console.log(i2cRes);

          var total = pinFail + sckFail + adcFail + dacFail + i2cFail;
          if (!total){
            console.log("0 FAILURES, ALL PASSED")
            console.log("{\"jsTest\": \"passed\"}");
          } else {
            console.log(total, "FAILURES");
            console.log("{\"jsTest\": \"failed\"}");
          }
        });
      });
    });
  });
});

// pinTest();
// sckTest();
// adcTest();
// dacTest();
// i2cTest();

