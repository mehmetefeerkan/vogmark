const path = "COM13"
const baudRate = 115200
const { SerialPort } = require('serialport')
const _port = new SerialPort({ path, baudRate })
const { ReadlineParser } = require('@serialport/parser-readline')
const EventEmitter = require('events');
const parser = _port.pipe(new ReadlineParser({ delimiter: '\n' }))
const port = new EventEmitter();

var SHA1 = require("crypto-js/sha1");
var MD5 = require("crypto-js/md5");
const express = require('express')
const app = express()
const expressPort = 3000

var benchmarks = {}
// console.log("Listening...");

parser.on('data', function (data) {
    var hash = data.slice(-40);
    const converted = data.slice(0, -40)
    const generatedHash = `${SHA1(converted)}`
    // console.log("raw", data);
    // console.log("hash", hash);
    // console.log("converted", converted);
    if (hash === generatedHash) {
        try {
            // console.log(converted);
            handleData(JSON.parse(converted))
        } catch {

        }
    }
})

function serialWrite(message) {
    _port.write(`${message}${SHA1(message)}\n`)
}

async function deviceConnected() {
    serialWrite("REQUEST_STATUS")
    return await awaitMessage("statusAck").then((msg) => {
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
            port.removeListener(messageType, _lstn)
            recieved = true
            message = recievedMessage
        }
        port.on(messageType, _lstn)
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
    });
    return recall
}

const speedBenchmark = function (id, name) {
    this.id = id
    this.name = `${name}`
    this.date = Date.now()
    this.speedData = {

    }
    this.streamListener = function (recievedStream) {
        console.log("rs", recievedStream);
    }
    const streamListener = this.streamListener
    port.on("stream", streamListener)
    this.end = function() {
        port.removeListener("stream", streamListener)
    }
    return this
}

app.get('/benchmark/speed/start/', async (req, res) => {
    // res.send(200, { ack: false });
    const benchmarkName = req.query.benchmarkName
    const benchmarkId = `${MD5(benchmarkName)}`
    if (benchmarks[benchmarkId]) {
        res.send(405, {
            error: "BENCHMARK_ALREADY_EXISTS"
        })
        return 
    }
    const deviceIsConnected = await deviceConnected()
    if (deviceIsConnected) {
        benchmarks[benchmarkId] = new speedBenchmark(benchmarkId, benchmarkName)
        res.send(benchmarks[benchmarkId])
    } else { 
        res.send({ status: false })
    }
})

app.get('/benchmark/speed/end', async (req, res) => {
    const benchmarkId = req.query.benchmarkId
    if ((!benchmarkId) || (!benchmarks[benchmarkId])) {
        res.send(405, {
            error: "NO_SUCH_BENCHMARK"
        })
    }
})

app.listen(expressPort, () => {
    console.log(`Example app listening on port ${expressPort}`)
})

function handleData(message) {
    // console.log(message);
    if (message.type === "statusAcknowledgement") {
        port.emit('statusAck', message)
    } else if (message.type === "stream") {
        port.emit('stream', message)
    }
} 