var fs = require("fs");
// get data from device file
function DeviceSettings(file){
	this.file = file;
}

DeviceSettings.prototype.process = function(parser, next){
	var stream = fs.createReadStream(this.file, {flags:'r', encoding:'utf-8'});
	var buf = '';
	var res = {};

	stream.on('data', function(d){
		buf += d.toString();
		process();
	});

	stream.on('end', function(d){
		buf += '\n';
		process();
	});


	function process(){
		while ((pos = buf.indexOf('\n')) >= 0) {
			if (pos == 0) {
				buf = buf.slice(1); 
				continue; 
			}
			getDeviceSettings(buf.slice(0,pos));
			buf = buf.slice(pos+1); 
		}
	}

	function getDeviceSettings(line){
		if (line[line.length-1] == '\r') line=line.substr(0,line.length-1); 

		if (line.length > 0) {
      var lineRes = line.split("=");
      if (parser.indexOf(lineRes[0]) != -1){
      	res[lineRes[0]] = lineRes[1];
      	parser.splice(parser.indexOf(lineRes[0]), 1);
      	if (parser.length <= 0){
      		next(res);
      	}
      }
	  }
	}
}

// var d = new DeviceSettings("device");
// d.process(['device', 'ip', 'port'], function(res){
// 	console.log("res", res);
// });

module.exports.create = function (file){
  return new DeviceSettings(file);
}