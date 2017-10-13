//******************************************
//************Dutchman & meifi2017**********
//*******************V 1.2****************** 
//******************************************

// define variable
var vbus = require('resol-vbus');
var headerSet = new vbus.HeaderSet();
var conn;

// Schedule every 20 seconds
schedule("*/20 * * * * *", function () {


//*****************************SET VARs***************************************************************************
var resolhost = '';                         // Can be used with via.vbus.net OR internal 192xxxxx adress !
var resolviaTag = 'xxxx';                   // only necessary if connected using VBus.net otherwise leave empty
var resolpass = 'vbus';                     //default is set
var resolDL3 = false;                       //set to true if you use a DL3
var worktime = 10000;                       // 10 second timer, collection all information takes some seconds [emoji6]
var create_states = false;                  // initial on true to create states once, disable value afterwards to update states !!!

//*****************************Dont edit something below**********************************************************

//check vars
    var regip = new RegExp("^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$");
    

if(resolDL3) {
    if (regip.test(resolhost)) {
        conn = new vbus.TcpConnection({
            host: resolhost,
            password: resolpass, 
            channel: 1,
        });
    } else {
        conn = new vbus.TcpConnection({
            host: resolhost,
            viaTag: resolviaTag,
            password: resolpass, 
            channel: 1,
    });
    }
} else {
        if (regip.test(resolhost)) {
        conn = new vbus.TcpConnection({
            host: resolhost,
            password: resolpass, 
        });
    } else {
        conn = new vbus.TcpConnection({
            host: resolhost,
            viaTag: resolviaTag,
            password: resolpass, 
    });
    }
}

    

    // Log connection status
    var onConnectionStateChange = function(state) {
    console.debug(state);
    };

    var onPacket = function(packet) {
        headerSet.addHeader(packet);
    };

    conn.on('connectionState', onConnectionStateChange);
    conn.on('packet', onPacket);

    conn.connect().done(function() {
        
        setTimeout(function() {
            conn.disconnect();

            //create header packages
            var packets = headerSet.getSortedHeaders();
            var spec = vbus.Specification.getDefaultSpecification();
            var packetFields = spec.getPacketFieldsForHeaders(packets);

            var packet = null;
            var counter = 0;
            var resoldeviceold = '';
            packetFields.forEach(function(packetField) {

                counter = counter + 1;
                if (packet !== packetField.packet) {
                    packet = packetField.packet;
                    console.debug(packetField.packetSpec.fullName);

                }
                // write values in memory
                packetField.name = packetField.name.replace(/ /g,"");
                var resoldevice = packetField.packetSpec.sourceDevice.deviceId
                
                console.debug("Value received : " + packetField.name + " = " + packetField.formatTextValue());
                
                rawvalue = packetField.formatTextValue();
                rawvalue = rawvalue.replace(/[^0-9.,]/g,"");
                
                console.debug("Value translated to raw format : " + rawvalue);

                // Create new objects only if "var create_states = true"
                if (create_states === true){
                    if (resoldevice != resoldeviceold){
                        createState("vbus." + resoldevice + ".device.deviceId" ,{
                            name: packetField.packetSpec.sourceDevice.deviceId,
                            type: 'string',
                            role: 'value'
                        });
                         createState("vbus." + resoldevice + ".device.channel" ,{
                            name: packetField.packetSpec.sourceDevice.channel,
                            type: 'string',
                            role: 'value'
                        });
                          createState("vbus." + resoldevice + ".device.selfAddress" ,{
                            name: packetField.packetSpec.sourceDevice.selfAddress,
                            type: 'string',
                            role: 'value'
                        });
                           createState("vbus." + resoldevice + ".device.peerAddress" ,{
                            name: packetField.packetSpec.sourceDevice.peerAddress,
                            type: 'string',
                            role: 'value'
                        });
                            createState("vbus." + resoldevice + ".device.name" ,{
                            name: packetField.packetSpec.sourceDevice.name,
                            type: 'string',
                            role: 'value'
                        });
                             createState("vbus." + resoldevice + ".device.fullName" ,{
                            name: packetField.packetSpec.sourceDevice.fullName,
                            type: 'string',
                            role: 'value'
                        });
                        resoldeviceold = resoldevice;
                    }
                    // create objects real data
                    createState("vbus." + resoldevice + ".values." + packetField.name ,{
                        name: packetField.name,
                        type: 'string',
                        role: 'value'
                    });
                    
                    // create objects raw data only
                    createState("vbus." + resoldevice + ".values_raw." + packetField.name ,{
                        name: packetField.name + "_raw",
                        type: 'string',
                        role: 'value'
                    });
                    

                } else {
                    // Update values
                    setState("vbus." + resoldevice + ".values." + packetField.name , packetField.formatTextValue(), true);
                    setState("vbus." + resoldevice + ".values_raw." + packetField.name , rawvalue, true);
                }
                
            });

            if (create_states === true){
                console.warn("States created change var create_states to False !!!");
            }

        
        }, worktime);
    });
    
});


//2017-10-12 meifi2017 - added new vars section and auto connection build
//2017-10-12 meifi2017 - added multi-device support
