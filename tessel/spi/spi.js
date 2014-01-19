var tessel = require('tessel');
var hw = process.binding('hw');

var addr = 0x2A;
var state = 1;
var hardware = tessel.port('A');

var chipSelect = hardware.gpio(1);

if (state == 0) {
  // spi master
  var spi = new hardware.SPI({clockSpeed:50000, SPIMode: hw.SPIMode.Master});
  chipSelect.output();

  setTimeout(function () {
    chipSelect.low();
    spi.transfer([0x01, 0x02, 0x03, 0xAA, 0xFF]);
    chipSelect.high();
  }, 300);

} else {
  // spi slave
  var spi = new hardware.SPI({clockSpeed:1000000, SPIMode: hw.SPI_SLAVE_MODE});
  // chipSelect.input();
  chipSelect.record();
  console.log("recording");
  chipSelect.on('fall', function(){
    console.log("fell");
    spi.transfer([0x00, 0x00, 0x00, 0x00], function(err, data){
      console.log("got data", data);
    });
  });
  
}