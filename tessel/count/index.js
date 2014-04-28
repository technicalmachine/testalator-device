var tessel = require('tessel');

var count = 0;

setInterval(function(){
  count++;
  console.log("{\"count\": "+count+"}");
}, 300);
