var AWS = require('aws-sdk'),
  fs = require('fs'),
  zlib = require('zlib'),
  archiver = require('archiver')
  ;

AWS.config.loadFromPath('./config.json');
var tarDir = __dirname + '/example-output.tar';

function compress(path, next){
  // batch up all the new device and bench logs

  var output = fs.createWriteStream(tarDir);
  var archive = archiver('tar');

  output.on('close', function() {
    console.log(archive.pointer() + ' total bytes');
    console.log('archiver has been finalized and the output file descriptor has closed.');
    next && next();
  });

  archive.on('error', function(err) {
    throw err;
  });

  archive.pipe(output);

  var benchFiles = fs.readdirSync(path);
  console.log("bench files", benchFiles);
  var deviceFiles = fs.readdirSync(path+"/devices");
  console.log("device files", deviceFiles);

  for(var i = 0; i<benchFiles.length; i++){
    if (benchFiles[i].split(".")[1] == "log") {
      archive.append(fs.createReadStream(__dirname+"/"+path+benchFiles[i]), { name: benchFiles[i] });
    }
  }

  for(var i = 0; i<deviceFiles.length; i++){
    if (deviceFiles[i].split(".")[1] == "log") {
      archive.append(fs.createReadStream(__dirname+"/"+path+"/devices"+deviceFiles[i]), { name: deviceFiles[i] });
    }
  }

  archive.finalize();
}

function slug(){
  compress("logs/", function(){

    var s3 = new AWS.S3(); 
    var date = new Date().toISOString();
    var file = fs.readFileSync(tarDir);
    var params = {Bucket: 'testalator-logs', Key: 'logs-'+date+".tgz", Body: file};
    
    s3.putObject(params, function(err, data) {
        if (err) console.log(err)     
        else console.log("Successfully uploaded data to myBucket/myKey");   
     });
  });
}

slug();