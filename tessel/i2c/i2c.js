var tessel = require('tessel');
var hw = process.binding('hw');

var addr = 0x2A;
var state = 1;
var hardware = tessel.port('C');

if (state == 0) {
  var i2c = new hardware.I2C(addr);
  i2c.initialize();
  var data = [0x01, 0x02, 0x03];
  
  console.log("sending");
  i2c.send(data, function(){
    console.log("sent", data);
  });
} else {
  console.log("hw.I2C_SLAVE", hw.I2C_SLAVE);
  var i2c = new hardware.I2C(addr, hw.I2C_SLAVE);
  i2c.initialize();

  
    console.log("tranferring");
    i2c.receive(5, function(err, data){
      console.log("got", data);
    });
}