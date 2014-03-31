var fs = require('fs');

var levels = {newDevice: "NEW", error: "ERROR", warning:"WARN", retry: "RETRY", data: "DATA"};

function Logger(bench, build, binaries) {
  // start up file log at this timestamp
  // bench: "<benchname>",
  // time: "timestamp",
  // build: "",
  // binaries: ""]
  this.bench = bench;
  this.build = build;
  this.binaries = binaries;
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
    this.date.getDate()+"-"+this.date.getHours()+"-"+this.date.getMinutes()+".log";

  var data = "bench: " + this.bench + "\ntime: "+this.date.toISOString()+"\nbuild: "
  + this.build+"\nbinaries: "+this.binaries+"\n"; 
  fs.appendFileSync(this.filename, data);
}

Logger.prototype.write = function(level, data){
  // [timestamp][level]: data

  // if it's a new hour, make a new file
  if (this._isNew()){
    this._updateFilename();
  }

  var date = new Date().toISOString();
  fs.appendFileSync(this.filename, "["+date+"]"+"["+level+"]"+": "+data);
}

Logger.prototype.device = function(id) {
  // open up new file in logs/device/device id

  // save with initial timestamp
  this.device = id;
  this.devicePath = "logs/devices/"+this.device;
  // fs.mkdirSync("logs/devices/");
  fs.appendFileSync(this.devicePath, new Date().toISOString());
  this.write(levels.newDevice, "Programming device #"+id);
}

Logger.prototype.deviceWrite = function(level, data){
  // write to both log file and device id file
  // [timestamp][level]: data
  fs.appendFileSync(this.devicePath, "["+new Date().toISOString()+"]["+level+"]: "+ data);
  this.write(level, data);
}

// Logger.prototype.__format = function(level, data){
  
// }

// Logger.prototype.__write = function(file, data){

//   // also log out the data
//   console.log(data); 
// }

module.exports.create = function(bench, build, binaries){
  return new Logger(bench, build, binaries);
}