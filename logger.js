var fs = require('fs'),
    http = require('http');

var HOST = "testalator.herokuapp.com";

function Logger(bench, build, binaries) {
  // start up file log at this timestamp
  // bench: "<benchname>",
  // time: "timestamp",
  // build: "",
  // binaries: ""]
  this.bench = bench;
  this.build = build;
  this.binaries = binaries;
  this.levels = {newDevice: "NEW", error: "ERROR", warning:"WARN", retry: "RETRY", data: "DATA"};
  this._updateFilename();  
}

Logger.prototype._isNew = function(){
  var currDate = new Date();
  if (currDate > this.date && currDate.getHours() > this.date.getHours()){
    return true;
  }
  return false;
}

Logger.prototype._updateFilename = function(){
  this.date = new Date();
  this.filename = "logs/"+(this.date.getYear()+1900)+"-"+this.date.getMonth()+"-"+
    this.date.getDate()+"-"+this.date.getHours()+".log";

  // var data = "bench: " + this.bench + "\ntime: "+this.date.toISOString()+"\nbuild: "
  // + this.build+"\nbinaries: "+this.binaries+"\n"; 
  // fs.appendFileSync(this.filename, data);
  this.write(this.levels.newDevice, "bench", this.bench);
  this.write(this.levels.newDevice, "time", this.date.toISOString());
  this.write(this.levels.newDevice, "build", this.build);
  this.write(this.levels.newDevice, "binaries", this.binaries);
}

Logger.prototype.writeAll = function (level, key, data){
  this.write(level, key, data);
  this.deviceWrite(level, key, data);
}

Logger.prototype.write = function(level, key, data){
  // [timestamp][level]: data

  // if it's a new hour, make a new file
  if (this._isNew()){
    this._updateFilename();
  }

  var writeData = "["+new Date().toISOString()+"]";
  if (key === undefined && data === undefined) {
    key = "data";
    data = level;
    level = this.levels.data;
  } 

  writeData += "["+level+"]: "+ "{\'"+key+"\': \'"+data+"\'}";

  // var writeData = "["+date+"]"+"["+level+"]"+": "+"{\""+key+"\": \""+data+"\"";
  fs.appendFileSync(this.filename, "\n"+writeData);
  console.log(writeData);

  var dataString = {"device": this.bench, "data":writeData};

  var options = {
    host: HOST,
    path: '/b/'+this.bench+"/logs",
    method: 'POST',
    headers: {'Content-Type': 'application/json', 
    'Content-Length': Buffer.byteLength(JSON.stringify(dataString))}
  };

  var req = http.request(options, function(response) {
    var str = ''
    response.on('data', function (chunk) {
      str += chunk;
    });

    response.on('end', function () {
      console.log(str);
    });
  });
  // console.log("res writing", dataString);
  req.write(JSON.stringify(dataString));
  req.end();
}

Logger.prototype.clearDevice = function(){
  this.device = "";
  this.deviceFirmware = "";
  this.deviceRuntime = "";
  this.deviceOtp = "";
  this.devicePath = "";
}

Logger.prototype.device = function(data, path) {
  // open up new file in logs/device/device id

  // save with initial timestamp
  this.device = data.serial;
  this.deviceFirmware = data.firmware;
  this.deviceRuntime = data.runtime;
  this.deviceOtp = data.board;
  this.devicePath = "logs/devices/"+this.device;
  this.deviceBuild = new Date().toISOString();
  // fs.mkdirSync("logs/devices/");
  fs.appendFileSync(this.devicePath, this.deviceBuild);
  this.write(this.levels.newDevice, "device", data.serial);
  this.write(this.levels.newDevice, "firmware", data.firmware);
  this.write(this.levels.newDevice, "runtime", data.runtime);
  this.write(this.levels.newDevice, "otp", data.board);
}

Logger.prototype._checkDevice = function(){
  if (this.device == "" || this.device === undefined){
    return false;
  }
  return true;
}

Logger.prototype.deviceWrite = function(level, key, data){
  if (!this._checkDevice()) {
    return console.error("no device id found, cannot log");
  }
  // write to both log file and device id file
  // [timestamp][level]: data
  var writeData = "["+new Date().toISOString()+"]";
  if (key === undefined && data === undefined) {
    key = "data";
    data = level;
    level = this.levels.data;
  } 

  writeData += "["+level+"]: "+ "{\'"+key+"\': \'"+data+"\'}";

  fs.appendFileSync(this.devicePath, "\n"+writeData);
  // this.write(level, key, data);

  // write data up to http endpoint
  var dataString = {"device": this.device, "data":writeData};
  var options = {
    host: 'testalator.herokuapp.com',
    path: "/d/"+this.device+"/logs",
    method: 'POST',
    headers: {'Content-Type': 'application/json', 
      'Content-Length': Buffer.byteLength(JSON.stringify(dataString))}
  };

  var req = http.request(options, function(response) {
    var str = ''
    response.on('data', function (chunk) {
      str += chunk;
    });

    response.on('end', function () {
      console.log(str);
    });
  });

  req.write(JSON.stringify(dataString));
  req.end();
}

Logger.prototype.deviceUpdate = function(test, status) {
  // pushes device programming status up to testalator

  if (!this._checkDevice) {
    return console.error("no device id found, cannot update");
  }

  var dataString = {"device": this.device, 
    "firmware": this.deviceFirmware, 
    "built": this.deviceBuild,
    "runtime": this.deviceRuntime,
    "otp": this.deviceOtp,
    "test": test, 
    "status":status};

  var options = {
    host: HOST,
    path: "/d/"+this.device+"/test/",
    method: 'POST',
    headers: {'Content-Type': 'application/json', 
      'Content-Length': Buffer.byteLength(JSON.stringify(dataString))}
  };

  var req = http.request(options, function(response) {
    var str = ''
    response.on('data', function (chunk) {
      str += chunk;
    });

    response.on('end', function () {
      console.log(str);
    });
  });

  req.write(JSON.stringify(dataString));
  req.end();
}



module.exports.create = function(bench, build, binaries){
  return new Logger(bench, build, binaries);
}