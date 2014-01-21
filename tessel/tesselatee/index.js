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
    OK = 0x0F
    ;

var i2c = new ports['A'].I2C(addr);
i2c.initialize();


function pinTest(next){
  console.log("===== pin test =====");
  var passing = 0;
  var failing = 0;
  i2c.transfer([PIN_TEST], 1, function(err, data) {
    console.log("sent pin test cmd", PIN_TEST, " got response ", data);
    if (data[0] == OK) {
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
            failing = failing + 1;
          } else {
            console.log("PASS: pin ", pin.pin, " on port ", port);
            passing = passing + 1;
          }
          if (numDone >= 17) {
            console.log("===== pin test: DONE ", passing, "passing ", failing, " failing =====");
            next && next();
          } 
          numDone = numDone +1;
        }
      });
    }
  });
}


function sckTest(next){
  console.log("===== sck test =====");
  var spi = ports['A'].SPI({clockSpeed:100});
  // sending that we're going to do an sck test and we have 5 pins to test
  i2c.transfer([SCK_TEST], 1, function(err, data) {
    console.log("sent sck test cmd", SCK_TEST, " got response", data);
    // look through all the gpios
    var numDone = 0;
    // Object.keys(ports).forEach(function(port, index){
      // tell the slave which port we're testing
      var port = 'A';
      console.log("port ", port.charCodeAt(0));
      i2c.send([SCK_PORT, port.charCodeAt(0)], function(port_err) {
        
        // send anything over spi to test the clk pin
        spi.transfer([0xAA], function(spi_err, spi_data){
          // read back how many ports the slave read
          i2c.transfer([SCK_READ], 2, function(read_err, read_data){
            console.log("got sck read data", read_data);
            // make sure clock went 8 cycles
            if (read_data[1] != 16){
              console.log("FAIL: sck did not hit 8");
            } else {
              console.log("PASS: sck on port ", port, read_data[1]);
            }

            if (numDone >= 5) {
              console.log("===== sck test: DONE =====");
              next && next();
            }
            numDone = numDone + 1;
          });
        });
      });
    // });
  });
}

function adcTest(next){
  console.log("===== adc test =====");

  i2c.transfer([ADC_TEST], 1, function(err, data) {
    console.log("sent adc test cmd", ADC_TEST, " got response ", data);
    for (var i = 1; i < 7; i++) {
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
  ports['G'].analog(4).write(512);

  i2c.transfer([DAC_TEST], 1, function(err, data) {
    console.log("sent dac test cmd", DAC_TEST, " got response ", data);
    i2c.transfer([DAC_READ], 4, function(read_err, read_data){
 
      var dac_data = (read_data[0] << 24) + (read_data[1] << 16) + (read_data[2] << 8) + read_data[3]; 
      console.log("getting back dac read ", read_data, dac_data);
      if (dac_data < 500 || dac_data > 524){
        // we faillled
        console.log("FAIL: dac might be sending the wrong value. got this ", dac_data);
      } else {
        console.log("PASS: dac passed", dac_data);
      }
      console.log("===== dac test: DONE =====");
      next && next();
    });
  });
}

console.log("executing tests");
// pinTest();
// sckTest();
// adcTest();
// dacTest();

