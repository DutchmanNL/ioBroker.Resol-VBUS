# ioBroker.Resol-VBUS
Script to extract and sent data from Resol system by VBUS data transmittion

Using this script will allow you to:
1) Read all values your Resol system provides, these values are updated every 30 seconds
2) Write changes directly to your resol system to control temperature, pumps etc.

Connections can be established directly within your internal network or by using the cloud service vbus.net

Prerequesites:
1) Working iObroker installation
2) Javascript Adapter installed
3) A resol-vbus capable device within your network or reachable by vbus.net

The following modules must be installed : resol-vbus, express, kue, optimist

There are 2 options to do that

Option 1 : add the NPM modules seperated by comma into your javascript instance at "Additional NPM modules"
Option 2 : installation by command line:

1) logon with SSH to your iobroker installation
2) go to your installation directory '/opt/iobroker/node_modules/iobroker.javascript/'
3) run the commands below to install the required packages packages:
```
sudo npm install resol-vbus
sudo npm install express
sudo npm install kue
sudo npm install optimist
```

Now go to your script tab and create a new script, copy and paste the content of Resol-VBUS.js
Adjust connection settings to fullfill your needs:

```
var config = {
    "connection": {
        "class": "TcpConnection",
        "options": {
            "host": "192.168.178.100", // IP-Adress or VBus.net Adres
            "viaTag": "", // When using VBus.net you need to provide your viaTag here !
            "password": "vbus", // Your password, usual : "vbus"
            // "channel" : "1" 		// Only needed when using a  DL3 and by that disabled, remove "//" up front when using an DL3
        }
    }
};
```

