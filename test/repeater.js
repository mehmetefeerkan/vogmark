const { SerialPort, ReadlineParser } = require('serialport')
const ingress = new SerialPort({ path: "COM6", baudRate: 115200 })
const exgress = new SerialPort({ path: "COM13", baudRate: 9600 })
parser = ingress.pipe(new ReadlineParser({ delimiter: '\r\n' }))


ingress.on('data', function(d) {
    exgress.write(d)
})
parser.on('data', function (data) {
    console.log(data)
})