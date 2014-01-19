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
    DAC_READ = 0x42
    ;

var i2c = new ports['A'].I2C(addr);
i2c.initialize();

function send(cmd, next){
  i2c.send([cmd], function(err, data){
    next(err, data);
  });
}

function pinTest(next){
  console.log("===== pin test =====");
  send(PIN_TEST, function(err, data) {
    console.log("sent pin test cmd", PIN_TEST, " got response ", data);
    // look through all the gpios
    var numDone = 0;
    Object.keys(ports).forEach(function(port){
      for (var i = 1; i < 3; i++) {
        var pin = ports[port].gpio(1).input();
        if (pin.read() != 0){
          console.log("FAIL: pin ", pin, " on port ", port, " is not low");
        } else {
          console.log("PASS: pin ", pin, " on port ", port);
        }
        if (numDone >= 5) {
          console.log("===== pin test: DONE =====");
          next && next();
        }
        numDone = numDone +1;
      }
    });
  });
}

function sckTest(next){
  console.log("===== sck test =====");

  // sending that we're going to do an sck test and we have 5 pins to test
  i2c.send([SCK_TEST, 5], function(err, data) {
    console.log("sent sck test cmd", SCK_TEST, " got response ", data);
    // look through all the gpios
    var numDone = 0;
    Object.keys(ports).forEach(function(port, index){
      // tell the slave which port we're testing
      i2c.send([SCK_PORT, port], function(port_err, port_data) {
        var spi = ports[port].SPI({clockSpeed:10000});

        // read back how many ports the slave read
        spi.transfer([0xAA], function(spi_err, spi_data){
          send(SCK_READ, function(read_err, read_data){
            console.log("got sck read data", read_data);
            // make sure clock went 8 cycles
            if (read_data != 16){
              console.log("FAIL: sck did not hit 8");
            } else {
              console.log("PASS: sck on port ", port, read_data);
            }

            if (numDone >= 5) {
              console.log("===== sck test: DONE =====");
              next && next();
            }
            numDone = numDone + 1;
          });
        });
      });
    });
  });
}

function adcTest(next){
  console.log("===== adc test =====");

  send(ADC_TEST, function(err, data) {
    console.log("sent adc test cmd", ADC_TEST, " got response ", data);
    for (var i = 1; i < 6; i++) {
      var val = ports['G'].analog(i).read();
      console.log("read ", val, " from analog pin ", i);
      if (val < 500 || val > 524) {
        console.log("FAIL: value of analog pin ", i, " is wrong: ", val);
      } else {
        console.log("PASS: analog pin ", i, val);
      }
    }
    console.log("===== adc test: DONE =====");
    next && next();
  });
}

function dacTest(next){
  console.log("===== dac test =====");
  ports['G'].analog(3).write(512);

  send(cmd, function(err, data) {
    console.log("sent dac test cmd", cmd, " got response ", data);
    send(DAC_READ, function(read_err, read_data){
      console.log("getting back dac read ", read_data);
      if (read_data < 500 || read_data > 524){
        // we faillled
        console.log("FAIL: dac might be sending the wrong value. got this ", read_data);
      } else {
        console.log("PASS: dac passed", read_data);
      }
      console.log("===== dac test: DONE =====");
      next && next();
    });
  });
}

console.log("executing tests");
pinTest(
  sckTest(
    adcTest(
      dacTest(){}
    ){}
  ){}
);
