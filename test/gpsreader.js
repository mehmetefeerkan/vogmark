const path = "COM6"
const baudRate = 115200
const { SerialPort, ReadlineParser } = require('serialport')
const serialPort = new SerialPort({ path, baudRate })
const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }))
const EventEmitter = require('events');
const GPS = require('gps');

const gps = new GPS;

parser.on('data', function(msg){
    // console.log(msg);
    gps.update(msg);
})


// Add an event listener on all protocols
gps.on('data', data => {
    console.log(data, gps.state);
  })