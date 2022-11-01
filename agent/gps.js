var path = ""
var baudRate = 115200

const { SerialPort } = require('serialport')
const { ReadlineParser } = require('@serialport/parser-readline')
const gpsLib = require("gps")
var gpsConnection = null;
var serialPort = null
var parser = null
var locked = false

const EventEmitter = require('events');
const gpsEmitter = new EventEmitter();
var incr = 0.5
function _emit(msg) {
    if (msg.speed) {
        msg.speed = msg.speed + incr
        incr = incr + 0.5
    }
    // console.log(msg);
    gpsEmitter.emit("data", msg)
}

function serialWrite(message) {
    serialPort.write(`${message}${SHA1(message)}\n`)
}

async function deviceConnected() {
    return await awaitMessage("data").then((msg) => {
        return true
    }).catch((err) => {
        return false
    })
}

async function awaitMessage(messageType, overrideTime_) {
    const overrideTime = overrideTime_ || 1000
    const recall = new Promise((resolve, reject) => {
        var recieved = false
        var message = null
        const _lstn = function (recievedMessage) {
            gpsEmitter.removeListener(messageType, _lstn)
            recieved = true
            message = recievedMessage
        }
        gpsEmitter.on("data", _lstn)
        setTimeout(() => {
            if (recieved) {
                resolve(message)
            } else {
                setTimeout(() => {
                    if (recieved) {
                        resolve(message)
                    } else {
                        reject()
                    }
                }, overrideTime);
            }
        }, overrideTime);
    }).catch(function (error) {
        console.log(error);
    })
    return recall

}

module.exports = {
    setDevice: function (_path, _baudRate) {
        path = _path
        baudRate = parseInt(_baudRate) || 115200
    },
    openPort: async function () { //TODO : Convert to promise.
        if (locked) return false;
        serialPort = new SerialPort({ path, baudRate })
        parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }))
        gpsConnection = new gpsLib;
        parser.on('data', function (data) {
            gpsConnection.update(data)
        })
        gpsConnection.on('data', _emit)
        const awaitMsg = await awaitMessage("data", 3000)
        if (awaitMsg) {
            locked = true
            return true
        } else {
            return false
        }
    },
    write: serialWrite,
    isConnected: deviceConnected,
    awaitMessage: awaitMessage,
    closeConnection: function () {
        gpsConnection = null
        serialPort.close()
        parser = null
        locked = false
    },
    getState: function () {
        if (!gpsConnection) return null
        gpsConnection.state.port = path
        return gpsConnection.state
    },
    emitter: gpsEmitter
}

setInterval(() => {

}, 1000);