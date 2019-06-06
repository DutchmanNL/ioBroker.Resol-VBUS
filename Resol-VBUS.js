//******************************************
//************Dutchman & meifi2017**********
//*******************V 0.9****************** 
//******************************************

// define variable
var vbus = require('resol-vbus');
var headerSet = new vbus.HeaderSet();
var conn;
var create_states = false; // !!! set initial on true to create states once, disable value afterwards to update states !!

// Schedule every 20 seconds
schedule("*/20 * * * * *", function () {


//*****************************SET VARs***************************************************************************
var resolhost = '192.168.150.100';      // Can be used with via.vbus.net OR internal 192xxxxx adress !
var resolviaTag = 'xxxx';                   // only necessary if connected using VBus.net otherwise leave empty
var resolpass = 'vbus';                 //default is set
var resolDL3 = false;           //set to true if you use a DL3
var worktime = 10000;           // 10 second timer, collection all information takes some seconds Bild

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
            
            packetFields.forEach(function(packetField) {
                counter = counter + 1;
                if (packet !== packetField.packet) {
                    packet = packetField.packet;
                    console.debug(packetField.packetSpec.fullName);

                }
                // write values in memory
                packetField.name = packetField.name.replace(/ /g,"");
				var recvalue = packetField.formatTextValue();
				var sepvalue = recvalue.split(" ");
				var recnumber = parseFloat(recvalue);
				var rectype = (sepvalue.slice(-1)[0]);
				var lastChar = packetField.formatTextValue().substr(packetField.formatTextValue().length - 1);
                var objtype = "number";
                
				if (packetField.name == "Systemdate") {
	    		    recnumber = recvalue;
				    objtype = 'mixed';
				}                


				if (lastChar == '%') {
				    rectype = lastChar;
				} else if (isFinite(lastChar) == true)  {
				    rectype = "";
			    }

                // Create new objects only if "var create_states = true"
                if (create_states === true){
                    
                    // create objects real data
                    createState("vbus.values." + packetField.name ,{
                        name: packetField.name,
                        type: objtype,
                        role: 'value',
                        unit: rectype,
                        def: recnumber
                    });
                    
                } else {
                    // Update values
                    setState("vbus.values." + packetField.name , recnumber, true);
                }
                
            });

            if (create_states === true){
                console.warn("States created change var create_states to False !!!");
            }

        
        }, worktime);
    });
    
});


//2017-10-12 meifi2017 - added new vars section and auto connection build
