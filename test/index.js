const path = "COM14"
const baudRate = 115200
const { SerialPort, ReadlineParser } = require('serialport')
const serialPort = new SerialPort({ path, baudRate })
const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }))
const EventEmitter = require('events');
const port = new EventEmitter();
var SHA1 = require("crypto-js/sha1");
console.log("Listening...");

parser.on('data', function (data) {
    var hash = data.slice(-40);
    const converted = data.slice(0, -40)
    const generatedHash = `${SHA1(converted)}`
    // console.log("raw", data);
    // console.log("hash", hash);
    // console.log("converted", converted);
    if (hash === generatedHash) {
        try {
            console.log(converted);
            handleData((converted))
        } catch {

        }
    }
})

function serialWrite(type, message) {
    const toSend = JSON.stringify({ type: type, data: message })
    serialPort.write(`${toSend}${SHA1(toSend)}\n`)
}

var speed = 0
var satelliteCount = 10
var carData = {
    brand: "",
    model: "",
    traction: "",
    diagCodes: []
}
var location = {
    x: 40.9981373,
    y: 29.153437
}

setInterval(() => {
    speed = speed + 1
}, 100);

setInterval(() => {
    serialWrite("stream", {
        satellites: satelliteCount,
        location: location,
        speed: speed
    })
}, 500);

function handleData(message) {
    if (message === "REQUEST_STATUS") {
        port.emit('statusRequested')
    } else {
        port.emit("data", message)
    }
}

port.on('statusRequested', function () {
    serialWrite("statusAcknowledgement", { satellites: satelliteCount, car: carData, uptime: process.uptime()})
})