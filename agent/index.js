
const EventEmitter = require('events');
const port = new EventEmitter();

var SHA1 = require("crypto-js/sha1");
var MD5 = require("crypto-js/md5");

const express = require('express')
const gpsDevice = require('./gps.js');
const { SerialPort } = require('serialport');


const app = express()
app.use(require('cors')())
const { Server } = require("socket.io");

const io = new Server({
    cors: {
        origin: '*',
    } 
});
var socket = null
sequenceNumberByClient = new Map();

io.on("connection", (socketx) => {
    const timer = setInterval(() => {
        socket.emit("auxData", device) 
    }, 250);
    console.log("client connected.");
    socketx.on("disconnect", () => {
        clearInterval(timer)
        console.log("client disconnected.");
    });
    socket = socketx
});



// sends each client its current sequence number

io.listen(8080);
const expressPort = 3000

var benchmarks = {}


var device = {
    speed: 0, 
    lat: 0,
    lon: 0,
    alt: 0,
    pitch: 0,
    sats: 0,
    satsInView: 0, 
}

const speedBenchmark = function (id, name, goals) {
    this.id = id
    this.name = `${name}`
    this.date = Date.now()
    this.speedGoals = {}
    mainTimer = null
    speedGoals = this.speedGoals
    var speedGoalsToComplete = 0
    var speedGoalsCompleted = 0
    const speedGoal = function (startsAt, endsAt) {
        this.starts = startsAt;
        this.ends = endsAt;
        this.ended = false
        this.started = false
        var clock = null
        this.elapsed = 0
        this.check = function (speed) {
            if (startsAt < endsAt) {
                if ((speed >= this.starts) && !this.started && !this.ended) {
                    // console.log("id, s, starts, started |", `${startsAt}-${endsAt}`, speed, this.starts, this.started);
                    clock = setInterval(() => {
                        this.elapsed = this.elapsed + 10
                    }, 100);
                    this.started = true
                }
                if ((speed >= this.starts) && (speed >= this.ends) && this.started && !this.ended) {
                    clearInterval(clock)
                    // console.log("s, ends, ended |", speed, this.ends, this.ended);
                    this.ended = true
                    speedGoalsCompleted++
                    this.finished = Date.now()
                }
            } else {
                if ((speed <= this.starts) && !this.started && !this.ended) {
                    clock = setInterval(() => {
                        this.elapsed = this.elapsed + 10
                    }, 100);
                    this.started = true
                }
                if ((speed <= this.starts) && (speed <= this.ends) && this.started && !this.ended) {
                    clearInterval(clock)
                    // console.log("s, ends, ended |", speed, this.ends, this.ended);
                    this.ended = true
                    speedGoalsCompleted++
                    this.finished = Date.now()
                }
            }
        }
    }
    goals.forEach(requestedSpeedGoal => {
        const speedgoal = new speedGoal(requestedSpeedGoal.start, requestedSpeedGoal.end)
        speedGoals[`${requestedSpeedGoal.start}-${requestedSpeedGoal.end}`] = speedgoal
        speedGoalsToComplete++
    });
    this.streamListener = function (recievedStream) {
        if (recievedStream.speed) {
            // console.log("speed", recievedStream.speed);
            Object.keys(speedGoals).forEach(sg => {
                speedGoals[sg].check(recievedStream.speed)
            })
        }
        
    }
    const streamListener = this.streamListener
    gpsDevice.emitter.on("data", streamListener)
    this.end = function () {
        gpsDevice.emitter.off("data", streamListener)
        clearInterval(mainTimer)
        delete benchmarks[id]
    }
    const endthis = this.end
    mainTimer = setInterval(() => {
        socket.emit("benchmarkData", speedGoals)
        if (speedGoalsToComplete === speedGoalsCompleted) {
            endthis()
        }
    }, 100);
    return this 
}

function decodeSpeedGoals(str) {
    var goals = []
    str.split(",").forEach(split1 => {
        goals.push({ start: split1.split("-")[0], end: split1.split("-")[1] })
    });
    return goals
}

app.post('/benchmark/speed/start/', async (req, res) => {
    // res.send(200, { ack: false });
    const benchmarkName = req.query.benchmarkName
    const benchmarkId = `${MD5(benchmarkName)}`
    if (benchmarks[benchmarkId]) {
        res.send(405, {
            error: "BENCHMARK_ALREADY_EXISTS"
        })
        return
    }
    const deviceIsConnected = await gpsDevice.isConnected()
    if (deviceIsConnected) {
        console.log("devcon");
        benchmarks[benchmarkId] = new speedBenchmark(benchmarkId, benchmarkName, decodeSpeedGoals(req.query.speedGoals || "[0-100]"))
        res.send(benchmarks[benchmarkId])
    } else {
        res.send({ status: false })
    }
})

app.post('/benchmark/speed/end', async (req, res) => {
    const benchmarkId = req.query.benchmarkId
    if ((!benchmarkId) || (!benchmarks[benchmarkId])) {
        res.send(405, {
            error: "NO_SUCH_BENCHMARK"
        })
    } else {
        benchmarks[benchmarkId].end()
        delete benchmarks[benchmarkId]
    }
})
app.get('/benchmark/speed/view', async (req, res) => {
    const benchmarkId = req.query.benchmarkId
    if ((!benchmarkId) || (!benchmarks[benchmarkId])) {
        res.send(405, {
            error: "NO_SUCH_BENCHMARK"
        })
    } else {
        res.send(benchmarks[benchmarkId])
    }
})
app.post('/device/init', async (req, res) => {
    const devicePort = req.query.port || "COM6"
    const deviceBaudRate = req.query.baudrate || 115200
    gpsDevice.setDevice(devicePort, deviceBaudRate)
    const portIsOpen = await gpsDevice.openPort()
    if (portIsOpen) {
        res.send(gpsDevice.getState())
        gpsDevice.emitter.on('data', (data) => {
            // console.log(data);
            if (data.lat) {
                device.lat = data.lat
            }
            if (data.lon) {
                device.lon = data.lon
            }
            if (data.alt) {
                device.alt = data.alt
            }
            if (data.satellites && data.type == "GSV") {
                device.sats = data.satellites.length
            }
            if (data.satsInView) {
                device.satsInView = data.satsInView
            }
            if (data.speed) {
                device.speed = data.speed
            }
        })
    } else {
        res.send(500)
    }
})
app.get('/device/current', async (req, res) => {
    const deviceIsConnected = await gpsDevice.isConnected()
    if (deviceIsConnected) {
        res.send(gpsDevice.getState())
    } else {
        res.send(500) 
    }
})  
app.get('/device/getPorts', async (req, res) => {
    res.send(await SerialPort.list())
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

function measure(lat1, lon1, lat2, lon2) {  // generally used geo measurement function
    var R = 6378.137; // Radius of earth in KM
    var dLat = lat2 * Math.PI / 180 - lat1 * Math.PI / 180;
    var dLon = lon2 * Math.PI / 180 - lon1 * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d * 1000; // meters
}